# FRH — Architecture Reference

This document describes the high-level architecture of Frank's Retirement Home, with particular focus on decisions that affect how new features should be built: the shared component model, the admin mirror page pattern, and the homepage content management system.

---

## System overview

FRH is a Next.js 14 App Router application backed by Supabase PostgreSQL via Prisma ORM.

| Layer | Technology | Role |
|---|---|---|
| Framework | Next.js 14 (App Router) | Routing, SSR, API routes |
| Database | Supabase PostgreSQL | Canonical data store |
| ORM | Prisma 5 | Database access, migrations |
| Realtime | Server-Sent Events (SSE) | Draft room live updates |
| Auth (admin) | HMAC-signed session cookie | Admin dashboard access |
| Auth (captain/player) | Discord OAuth + URL key fallback | Captain match/draft access |
| OCR | Google Gemini Vision (`lib/gemini.js`) | Screenshot stat extraction |
| Hosting | Vercel | Deployment platform |

---

## Data flow principles

### Canonical vs. staging data

FRH maintains a strict boundary between staging (unreviewed) and canonical (approved) data.

**Canonical tables** — readable by public routes:
- `StatLine`, `Game`, `Match`, `Team`, `Season`, `Division`, `Player`, `God`, `Draft`, `HomepageContent`

**Staging tables** — admin-only:
- `MatchSubmission`, `SubmissionAttachment`, `OcrExtraction`, `ExtractedStatLine`

Public routes, exports, and standings must **never** query staging tables. The Prisma schema enforces this structurally — `StatLine` has no concept of "pending" because pending stats exist only in `ExtractedStatLine`.

See `docs/review-queue-policy.md` for the full policy.

### Database client

All database access goes through a single Prisma client singleton at `lib/db.js`:

```js
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
```

This is the only Prisma client in the codebase. No route should instantiate its own `PrismaClient`.

### Connection strategy

- `DATABASE_URL` (port 6543, Supabase Supavisor Transaction mode) — used by the running app
- `DIRECT_URL` (port 5432, Supabase Supavisor Session mode) — used by Prisma CLI for migrations

See `docs/PRISMA_WORKFLOW.md` for details.

---

## Shared component model

FRH uses a shared component library under `components/ui/` and `components/`. The principle is **one component, multiple contexts** — the same component renders in the public-facing page, the admin mirror page, and any other context, with behaviour controlled by props, not by duplicating the component.

### Core UI kit

| Component | Location | Purpose |
|---|---|---|
| `RetroWindow` | `components/ui/` | Windows-95 style bordered panel, the primary layout primitive |
| `BrutalButton` | `components/ui/` | Primary action button with offset shadow |
| `PixelBadge` | `components/ui/` | Pill badge with coloured border |
| `StatusBadge` | `components/ui/` | Auto-coloured status badge (wraps PixelBadge) |
| `EditableField` | `components/` | Inline editor overlay; renders as plain text when `onEdit` is absent |

### Why shared components matter

Duplicating markup between a public page and an admin version of that page creates two sources of truth. When the design changes, both copies must be updated in sync. When they drift, the admin sees a different layout than the public, undermining the "what you see is what they see" guarantee that makes admin editing trustworthy.

**The rule:** if the same content needs to appear on a public page and an admin configuration page, extract it to a shared component and pass props to control mode (`public` vs. `editor`).

---

## Admin mirror page pattern

Some public pages have editable content. Instead of building a separate admin form that doesn't resemble the public page, FRH uses the **admin mirror pattern**:

1. The public page renders at `/route`
2. The admin mirror renders at `/admin/route`
3. Both use the **same shared components**
4. The admin mirror passes `mode="editor"` (or equivalent props) to enable inline editing controls
5. Public rendering is unchanged — editor props have safe defaults that produce identical output to the pre-edit behaviour

### Applied example: Homepage Editor

The homepage (`app/page.js` → `app/HomepageClient.js`) renders editorial sections (ticker, headlines, rankings, etc.) using named exported sub-components.

The admin mirror (`app/admin/homepage/page.js` → `app/admin/homepage/HomepageEditorClient.js`) renders the same `HomepageClient` component with `mode="editor"`:

```jsx
// Public page (app/page.js)
<HomepageClient
  mode="public"
  editableContent={publishedContent}
  activeSeason={...}
  liveMatches={...}
/>

// Admin mirror (app/admin/homepage/HomepageEditorClient.js)
<HomepageClient
  mode="editor"
  editableContent={draftContent}
  onContentChange={handleChange}
  activeSeason={...}
  liveMatches={...}
/>
```

The `EditableField` component is the key primitive. It renders as plain text when `onEdit` is absent (public mode) and as a styled inline input when `onEdit` is provided (editor mode):

```jsx
// In a shared sub-component:
<h2>
  <EditableField
    value={headline.title}
    onEdit={isEditor ? v => onChange({ title: v }) : undefined}
  />
</h2>
```

In public mode, `onEdit` is `undefined`, so `EditableField` renders `<>{value}</>` — identical to before the editor was added.

---

## Draft/published homepage content model

The `HomepageContent` table stores editorial content for the homepage with two logical rows:

| `status` | Meaning | Who reads it |
|---|---|---|
| `"draft"` | Work in progress | Admin editor only (`/admin/homepage`) |
| `"published"` | Live content | Public homepage (`/`) |

### Fallback behaviour

If no `"published"` row exists, the public homepage falls back to the hardcoded JS defaults in `lib/homepageDefaults.js`. This means:

- Fresh deploys with no published content render exactly as they did before the editor existed
- There is no empty-page state
- The editor is purely additive — it cannot break the public page

### Flow

```
Admin edits content in /admin/homepage
  → clicks Save Draft
    → upserts HomepageContent { status: 'draft' }
    → public page unaffected

  → clicks Preview Public
    → opens /?preview=draft in new tab
    → reads the draft row instead of published

  → clicks Publish
    → saves draft first
    → upserts HomepageContent { status: 'published' }
    → public page now reads the new content

  → clicks Reset to Default
    → deletes the draft row
    → editor reloads with JS defaults
    → published content unaffected
```

### API

| Route | Method | Action |
|---|---|---|
| `/api/admin/homepage-content` | `GET` | Returns `{ draft, published }` rows |
| `/api/admin/homepage-content` | `POST` `{ action: 'save' }` | Upserts draft row |
| `/api/admin/homepage-content` | `POST` `{ action: 'publish' }` | Promotes draft to published |
| `/api/admin/homepage-content` | `DELETE ?target=draft` | Deletes draft (Reset to Default) |
| `/api/admin/homepage-content` | `DELETE ?target=published` | Reverts public page to defaults |

All write endpoints are guarded by `requireAdmin`.

---

## Page architecture summary

| Route type | Data source | Admin control |
|---|---|---|
| `/schedule` | DB: `Match` rows | Admin Schedule tab |
| `/standings` | DB: computed from approved `Game.winnerTeamId` | Admin Review Queue approval |
| `/teams`, `/teams/[id]` | DB: `Team`, `TeamMember` | Admin Teams tab |
| `/players` | DB: `Player` | Admin Players tab |
| `/matches/[id]` | DB: `Match`, `Game`, `Draft` | Admin Schedule tab |
| `/draft/[id]` | DB: `Draft` + SSE | Admin Drafts tab |
| `/captain` | DB: captain's matches (Discord auth) | N/A -- self-service |
| `/` (homepage) | DB: live data + `HomepageContent` (editorial) | **Admin Homepage Editor** `/admin/homepage` |

The homepage is the only public page with both data-driven content (live matches, standings) and admin-editable editorial content (ticker, headlines, etc.). All other public pages are fully data-driven and managed through the existing admin dashboard tabs.

### Homepage section breakdown

The homepage contains two categories of sections:

**Editorial sections** (admin-editable via `/admin/homepage`):
| Section | Default source | Admin override |
|---|---|---|
| Ticker | `lib/homepageDefaults.js` | Inline text editing, reorder, add/remove |
| Headlines (The Wire) | `lib/homepageDefaults.js` | Inline editing of stories |
| Bulletin Board | `lib/homepageDefaults.js` | Inline editing of posts |
| Fraud Watch | `lib/homepageDefaults.js` | Inline editing of cases |
| Match of the Week | `lib/homepageDefaults.js` | Inline editing of matchup details |
| Rivalry Systems | `lib/homepageDefaults.js` | Inline editing of rivalries |
| Knows Ball (Fake Analysts) | `lib/homepageDefaults.js` | Inline editing of picks |
| Washed Reports | `lib/homepageDefaults.js` | Inline editing of sightings |
| Social Cards | `lib/homepageDefaults.js` | Inline editing of share cards |
| Discord CTA | `lib/homepageDefaults.js` | Editable invite URL |
| Washed% | `lib/homepageDefaults.js` | Editable number |

**Computed sections** (data-driven, no admin override):
| Section | Data source | Behavior |
|---|---|---|
| Broadcast Hero (Live/Upcoming) | DB: `Match` (live/scheduled) | Shows live match or next scheduled |
| Active Draft Sessions | DB: `Draft` (lobby/banning/picking) | Shows when drafts are active |
| Recent Results | DB: `Match` (completed, last 5) | Shows last 5 completed matches |
| Power Rankings | DB: `divisionStandings` (computed standings) | Falls back to placeholder when no standings exist |
| Form Check (Hot/Cold Teams) | DB: `divisionStandings` (computed standings) | Hidden when fewer than 2 teams have standings |
| This Week's Slate | DB: `Match` (scheduled) | Shows upcoming scheduled matches |
| Division Standings | DB: computed from approved `Game.winnerTeamId` | Shows top 5 per division |

---

## SSE (realtime draft) architecture

Draft rooms use Server-Sent Events for real-time updates. The pattern:

1. Client connects to `/api/drafts/[id]/stream`
2. Server holds the connection open and sends state events when `Draft.version` increments
3. Client optimistically applies actions (ban/pick/ready) and reconciles on the next SSE event
4. `Draft.version` acts as an optimistic concurrency lock — conflicting writes are rejected

This pattern works correctly with Supabase's connection pooler because SSE stream connections stay on the Next.js server layer; they only make short-lived DB reads. There is no use of Supabase Realtime (`postgres_changes`), Supabase client SDK, or RLS.

---

## Auth architecture

FRH uses three separate auth mechanisms in parallel:

| Mechanism | Used for | Implementation |
|---|---|---|
| HMAC session cookie (`frh_admin_session`) | Admin dashboard + all admin API routes | `lib/adminSession.js` + `requireAdmin()` guard |
| Discord OAuth session cookie (`frh_discord_session`) | Captain/player routes | `lib/discordAuth.js` |
| URL key token (`?key=`, `X-Captain-Key` header) | Captain draft/match routes (fallback) | `lib/draftAuth.js` + `lib/resolveAuth.js` |

Discord OAuth is the primary path for captains. URL key tokens are the fallback when Discord is not configured (graceful degradation — the app fully functions without Discord env vars, returning HTTP 503 only on the OAuth routes themselves).

---

## Directory layout

```
app/
  page.js                    # Homepage (public) — reads HomepageContent from DB
  HomepageClient.js          # Homepage UI — shared public + editor component
  layout.js                  # Root layout (Nav, Footer)
  admin/
    page.js                  # Admin dashboard
    AdminClient.js           # Dashboard tabs + HomepageEditorPanel
    homepage/
      page.js                # Admin homepage editor (server)
      HomepageEditorClient.js # Editor shell (toolbar, auth, state)
  api/
    admin/
      homepage-content/      # CRUD for HomepageContent
    admin-auth/              # Admin session cookie
    auth/discord/            # Discord OAuth flow
    drafts/[id]/             # GodDraft actions + SSE stream
    player-drafts/[id]/      # PlayerDraft actions
    matches/[id]/            # Match detail + submissions
    ...

components/
  ui/                        # RetroWindow, BrutalButton, PixelBadge, etc.
  EditableField.js           # Inline editor overlay (used by HomepageClient)
  Nav.js
  Footer.js
  GodImage.js

lib/
  db.js                      # Prisma client singleton
  homepageDefaults.js        # Hardcoded defaults for all editable homepage sections
  adminSession.js            # HMAC session cookie management
  discordAuth.js             # Discord OAuth session management
  resolveAuth.js             # Unified auth resolver (Discord + key fallback)
  standings.js               # Standings computation (reads approved data only)
  usedGodIds.js              # Vault logic for GodDraft
  playerDraftOrder.js        # Pure buildPickSequence function
  draftState.js              # GodDraft state aggregation
  gemini.js                  # Google Gemini Vision API caller

prisma/
  schema.prisma              # Single source of truth for all models
  migrations/                # Committed migration SQL files
  seed.mjs                   # Seed script (Season 9, teams, players, gods)

docs/
  SETUP.md                   # ← Start here for environment setup
  PRISMA_WORKFLOW.md         # Prisma migration policy
  ARCHITECTURE.md            # This file
  DEPLOYMENT_NOTES.md        # Production deployment workflow
  league-ops-lifecycle.md    # Season lifecycle doctrine
  review-queue-policy.md     # Staging boundary and approval policy
  draft-architecture.md      # GodDraft + PlayerDraft system reference
  season-9-ops-reference.md  # S9 teams, scripts, route matrix
```
