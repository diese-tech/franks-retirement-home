# Season 9 Operations Reference

**Status: Living document — last updated 2026-05-26**

This document consolidates all operational findings, confirmed bugs, workflow
gaps, Discord OAuth mapping inputs, and recommended fixes produced during the
Season 9 pre-launch engineering audit. Return here before any match night,
before implementing Discord OAuth, and before running the S9 player draft.

---

## Table of Contents

1. [Database & Migration State](#1-database--migration-state)
2. [Current Team Roster](#2-current-team-roster)
3. [League Workflow Audit](#3-league-workflow-audit)
4. [Confirmed Bugs Fixed (This Session)](#4-confirmed-bugs-fixed-this-session)
5. [Remaining Workflow Gaps & Blockers](#5-remaining-workflow-gaps--blockers)
6. [Recommended Fix Plan](#6-recommended-fix-plan)
7. [Discord OAuth Role-Mapping Inputs](#7-discord-oauth-role-mapping-inputs)
8. [Route Authorization Matrix](#8-route-authorization-matrix)
9. [npm Scripts Reference](#9-npm-scripts-reference)
10. [Pre-Match-Night Checklist](#10-pre-match-night-checklist)

---

## 1. Database & Migration State

### Migration workflow

FRH uses **Prisma Migrate** as the source of truth. The `prisma/migrations/`
folder is committed to the repo.

| Command | Effect |
|---|---|
| `npm run db:reset` | `prisma migrate reset --force` — drops all tables, applies `20250526000000_init`, runs seed |
| `npm run db:migrate:dev` | `prisma migrate dev` — create a new migration from schema changes |
| `npm run db:migrate:deploy` | `prisma migrate deploy` — apply pending migrations to production |
| `npm run db:seed` | `node prisma/seed.mjs` — seeds gods, players, Season 9, divisions, sample draft |

**Never use `prisma db push` for deployments.** It bypasses migration history
and breaks `prisma migrate deploy`.

### Production database (Neon)

- Provider: Neon PostgreSQL, `us-east-1`
- Branch: `main` (default)
- `DATABASE_URL`: pooled connection (pgBouncer) — used at runtime
- `DIRECT_URL`: non-pooled — used by Prisma migrations

### Current seed state (post-reset)

| Table | Rows |
|---|---|
| Season | 1 (Season 9, `slug: s9`, status: `upcoming`) |
| Division | 2 (Hospice `div-s9-hospice`, Rehabilitation `div-s9-rehabilitation`) |
| Player | 20 |
| God | 81 |
| Draft | 1 (sample standalone draft) |
| **Team** | **10 (4 Hospice + 6 Rehabilitation)** |
| Match | 0 |
| Game | 0 |

### GitHub Actions CI / deploy

- **`build` job**: runs on every PR and push to main. Uses fake DB URL. Runs
  `npm ci → prisma generate → lint → build`.
- **`migrate` job**: runs on push to `main` only, after `build` passes. Runs
  `npx prisma migrate deploy` against the real Neon DB using
  `DATABASE_URL` / `DIRECT_URL` secrets set in GitHub → Settings → Secrets.

---

## 2. Current Team Roster

**As of this implementation, all 10 Season 9 teams are seeded with deterministic IDs.**

### Hospice Division (`div-s9-hospice`, tier 1)

| Team Name | Tag | Team ID | DB Status |
|---|---|---|---|
| The Galactic Stingers | GLXS | `team-galactic-stingers` | Seeded |
| Caustic Crusaders | CSTC | `team-caustic-crusaders` | Seeded |
| Death Dealers | DEAD | `team-death-dealers` | Seeded |
| Wheezy's Mafia | WHZY | `team-wheezys-mafia` | Seeded |

### Rehabilitation Division (`div-s9-rehabilitation`, tier 2)

| Team Name | Tag | Team ID | DB Status |
|---|---|---|---|
| The Ruined Order | RUIN | `team-ruined-order` | Seeded |
| Kappa Corp | KAPA | `team-kappa-corp` | Seeded |
| Exile Extinction | EXIL | `team-exile-extinction` | Seeded |
| Valhalla Vikings | VALK | `team-valhalla-vikings` | Seeded |
| Baba's Kitchen | BABA | `team-babas-kitchen` | Seeded |
| Cyberpunk Otters | CYBR | `team-cyberpunk-otters` | Seeded |

### How to retrieve team IDs after creation

> **Note:** Teams are now auto-seeded with deterministic IDs by `prisma/seed.mjs`. Manual creation is no longer required.

```sql
SELECT id, name, tag, "divisionId"
FROM "Team"
ORDER BY "divisionId", name;
```

Or via API (no auth required):

```bash
curl https://YOUR_HOST/api/teams
```

### How to create teams

> **Note:** Teams are now auto-seeded. This section is retained for reference only.

Use the Admin Dashboard > Teams tab, or call the API directly:

```bash
# Requires admin session cookie. divisionId from the table above.
curl -s -X POST https://YOUR_HOST/api/teams \
  -H "Content-Type: application/json" \
  -b "frh_admin_session=<token>" \
  -d '{
    "name": "The Galactic Stingers",
    "tag": "GLXS",
    "divisionId": "div-s9-hospice"
  }'
```

---

## 3. League Workflow Audit

### End-to-end match night flow (current state)

```
Admin creates match (POST /api/matches)
  └─ Game rows auto-created (BO1=1, BO3=3, BO5=5 games)
  └─ homeTeamCaptainKey + awayTeamCaptainKey generated on the match
  └─ NO draft rooms created yet ← GAP

Admin clicks "Open Draft" per game in Schedule tab
  └─ POST /api/matches/[id]/games/[gameId]/draft
  └─ Draft record created with captainAKey, captainBKey, adminKey
  └─ Draft pre-seeded with DraftPick rows from both teams' rosters

Admin shares captain links out-of-band
  └─ /draft/[id]?key=<captainAKey> → Captain A
  └─ /draft/[id]?key=<captainBKey> → Captain B
  └─ Match page link (/matches/[id]?key=<matchCaptainKey>) shows
     "Draft (status)" but goes to SPECTATOR view ← GAP

Captains enter draft room with correct key
  └─ Lobby: both ready up (self-service ✅)
  └─ Both ready → auto-transition to banning ✅
  └─ Banning: 6 bans (3 per team), alternating A/B (self-service ✅)
  └─ Picking: 10 picks, ABBA pattern (self-service ✅)
  └─ Draft complete

Captain uploads screenshot
  └─ /matches/[id]?key=<matchCaptainKey> → CaptainUploadSection
  └─ POST /api/ocr/extract → creates OcrExtraction + ExtractedStatLine rows
  └─ Admin reviews in Match Report tab, approves → sets Game.winnerTeamId

Admin approves submission
  └─ PATCH /api/submissions/[id] { action: 'approve' }
  └─ Game.winnerTeamId set, other submissions superseded

For BO3/BO5: admin manually opens Game 2/3 draft ← GAP

Admin manually marks match completed ← GAP
  └─ Admin dropdown in Schedule tab: status → 'completed'
```

---

## 4. Confirmed Bugs Fixed (This Session)

All fixes are on branch `fix/bug-sweep-may26` (merged to main).

### Bug 1 — Vault: prior-game bans incorrectly carried into later games

**File:** `lib/usedGodIds.js` — `getEffectiveVaultedGodIds()`  
**Symptom:** In a BO3/BO5, gods banned in Game 1 were blocked from being
picked in Game 2, even though the league rule is picks-only vaulting.  
**Fix:** Removed `bans` from the sibling-game aggregation loop. Only
`DraftPick.godId` values from prior games are now vaulted. Current-draft bans
still block picking within the same draft (unchanged).

### Bug 2 — PlayerDraft: wrong team computed for later-round picks

**Files:** `app/api/player-drafts/[id]/pick/route.js`,
`lib/playerDraftState.js`  
**Symptom:** `currentPickTeam(format, phaseIndex, stepIndex)` was called with
cursor coordinates instead of a flat index. The function signature is
`currentPickTeam(format, flatIndex)`. For round 1 (phaseIndex=0, stepIndex=0)
the result was coincidentally correct, but round 2+ picks went to the wrong
team.  
**Fix:** Use `turn.teamId` directly — the cursor navigation already resolves
the correct team. Removed unused `currentPickTeam` import from both files.

### Bug 3 — PlayerDraft: `start` action did not freeze `baseOrder`

**File:** `app/api/player-drafts/[id]/route.js` — `action: 'start'`  
**Symptom:** Starting a draft did not write `baseOrder`, violating the
architecture invariant that `baseOrder` is the immutable audit trail of the
originally approved pick order.  
**Fix:** Added `baseOrder: order` to the `start` update alongside
`status: 'active'`.

### Bug 4 — PlayerDraft: order/route accepted arbitrary team arrays

**File:** `app/api/player-drafts/[id]/order/route.js`  
**Symptom:** `PATCH /api/player-drafts/[id]/order` accepted any non-empty
array, allowing teams to be silently added or removed.  
**Fix:** Validate that the incoming `currentOrder` contains exactly the same
team IDs (same Set, same length) as the existing order.

### Bug 5 — PlayerDraft: `skip` action corrupted index permanently

**File:** `app/api/player-drafts/[id]/route.js` — `action: 'skip'`  
**Symptom:** `skip` advanced `currentPickIndex` without creating a
`PlayerDraftPick` row. Since `PlayerDraftPick.playerId` is non-nullable, the
completion validator (`picks.length < total`) would always fail after any skip,
permanently preventing draft completion.  
**Fix:** `skip` now returns `400` with an explanatory message. Use `undo` to
step backward or record the pick normally.

### Bug 6 — GodDraft: ready-up race condition

**File:** `app/api/drafts/[id]/ready/route.js`  
**Symptom:** Two captains hitting ready simultaneously could both read the
pre-transition state and neither trigger the lobby→banning transition, leaving
the draft stuck in lobby indefinitely.  
**Fix:** Replaced the plain `update` with `updateMany WHERE captainAReady=true
AND captainBReady=true AND status='lobby'` — exactly one writer wins the
transition.

### Earlier fix — Vault: bans not crossing game boundaries (vault bug original)

**File:** `lib/usedGodIds.js` (same function, related)  
See Bug 1 above — this was the same root cause found in the prior session.

---

## 5. Remaining Workflow Gaps & Blockers

> **Note (post-PR #94 / #95):** Captain-confirmed BO3 results, auto-created drafts per game,
> captain draft links surfaced on match page, and match auto-completion are all implemented.
> The gaps below reflect remaining items only.

### ~~BLOCKER — Captain links not surfaced on match page~~ RESOLVED

~~**Symptom:** A captain visiting `/matches/[id]?key=<matchCaptainKey>` sees
"Draft (status)" links that navigate to spectator view.~~
**Resolution:** Captain draft URLs are now surfaced correctly on the match page.

### ~~BLOCKER — GodDraft rooms require manual admin creation per game~~ RESOLVED

~~**Symptom:** After scheduling a match, Game rows exist but no Draft records.
Admin must click "Open Draft" in the Schedule tab for each game.~~
**Resolution:** Draft records are now auto-created.

### ~~HIGH — No automatic Game 2/3 draft creation in BO3/BO5~~ RESOLVED

~~**Symptom:** After Game 1 completes, admin must manually create Game 2's draft.
No automation exists.~~
**Resolution:** Next-game drafts are auto-created on game completion in BO3/BO5.

### ~~MEDIUM — Match status `completed` is always manual~~ RESOLVED

~~**Symptom:** Admin must manually set `status: 'completed'` via the admin
dropdown.~~
**Resolution:** Match auto-completes when the winning threshold is reached.

### MEDIUM — PlayerDraft picks are admin-only

**Symptom:** `POST /api/player-drafts/[id]/pick` is guarded by `requireAdmin`.
Captains cannot self-serve picks during the snake draft. Admin must manually
enter every pick on behalf of each team.
**Note:** This is an intentional design decision for S9. Captains communicate
picks verbally or via Discord; admin operates the board. Captain self-service
requires adding `captainAKey`/`captainBKey` to `PlayerDraft` (schema change)
and building a captain-facing pick UI.

### LOW — `nextGame` action is disconnected from match-bound drafts

**Symptom:** The `nextGame` action in `/api/drafts/[id]/admin` resets godId
assignments on the *current* Draft record (standalone mode). For match-bound
BO3/BO5, each game has its own separate Draft row — `nextGame` does nothing
useful for them.
**Impact:** Low — admin using match-bound drafts would not call `nextGame`.
But the button is visible in the UI and may confuse admins.

---

## 6. Recommended Fix Plan

Ordered by impact-to-effort.

| Priority | Fix | Effort | Unblocks |
|---|---|---|---|
| 1 | Surface draft captain URLs on match page | Small | Captains can self-serve GodDraft lobby → bans → picks with zero admin after room creation |
| 2 | Auto-create draft rooms when match goes `live` | Small-Medium | Removes "Open Draft" manual step per game |
| 3 | Auto-create Game 2/3 draft on game completion | Medium | BO3/BO5 between-game continuity |
| 4 | Auto-complete match when series winner reached | Small | Standings accuracy, removes manual admin step |
| 5 | PlayerDraft captain self-service | Large | Full captain self-service for player draft |

---

## 7. Discord OAuth Role-Mapping Inputs

### Environment variable template (Vercel)

```bash
# ─── Discord OAuth Application ────────────────────────────────────────────────
# From https://discord.com/developers/applications → your app → OAuth2
DISCORD_CLIENT_ID="YOUR_DISCORD_CLIENT_ID"
DISCORD_CLIENT_SECRET="YOUR_DISCORD_CLIENT_SECRET"

# ─── Discord Server (Guild) ───────────────────────────────────────────────────
# Right-click your server in Discord → Copy Server ID (Developer Mode must be on)
DISCORD_GUILD_ID="YOUR_DISCORD_GUILD_ID"

# ─── Role IDs ─────────────────────────────────────────────────────────────────
# Server Settings → Roles → right-click role → Copy Role ID

# Admin role — full dashboard access
DISCORD_ADMIN_ROLE_ID="YOUR_ADMIN_ROLE_ID"

# Captain roles (per-division) — one captain role per division
# Having either role means "is a captain" AND "belongs to this division"
DISCORD_HOSPICE_CAPTAIN_ROLE_ID="YOUR_HOSPICE_CAPTAIN_ROLE_ID"
DISCORD_REHABILITATION_CAPTAIN_ROLE_ID="YOUR_REHABILITATION_CAPTAIN_ROLE_ID"

# Player roles (per-division, comma-separated)
# These indicate active season players. Two skill-level roles per division.
# Hospice = Scooter + Wheelchair roles
# Rehabilitation = Walker + Canes roles
DISCORD_HOSPICE_PLAYER_ROLE_IDS="SCOOTER_ROLE_ID,WHEELCHAIR_ROLE_ID"
DISCORD_REHABILITATION_PLAYER_ROLE_IDS="WALKER_ROLE_ID,CANES_ROLE_ID"

# ─── Team → Discord Role Map ──────────────────────────────────────────────────
# JSON: { "<frh_team_id>": "<discord_role_id>", ... }
# FRH team IDs are deterministic (seeded by prisma/seed.mjs).
DISCORD_TEAM_ROLE_MAP_JSON='{
  "team-galactic-stingers":  "DISCORD_ROLE_ID",
  "team-caustic-crusaders":  "DISCORD_ROLE_ID",
  "team-death-dealers":      "DISCORD_ROLE_ID",
  "team-wheezys-mafia":      "DISCORD_ROLE_ID",
  "team-ruined-order":       "DISCORD_ROLE_ID",
  "team-kappa-corp":         "DISCORD_ROLE_ID",
  "team-exile-extinction":   "DISCORD_ROLE_ID",
  "team-valhalla-vikings":   "DISCORD_ROLE_ID",
  "team-babas-kitchen":      "DISCORD_ROLE_ID",
  "team-cyberpunk-otters":   "DISCORD_ROLE_ID"
}'
```

### How to fill in Discord role IDs

After creating team roles in your Discord server:

1. Enable Developer Mode: Discord Settings > Advanced > Developer Mode
2. Go to Server Settings > Roles
3. Right-click each team role > Copy Role ID
4. Replace the `DISCORD_ROLE_ID` placeholders above with the copied IDs

Team IDs are deterministic and do not change between environments (set in `prisma/seed.mjs`).

### Key notes on Discord role mapping

- **`DISCORD_TEAM_ROLE_MAP_JSON` is per-season.** If Discord role IDs change
  between seasons, this env var must be updated. Consider storing team->role
  mapping in the `Team` table instead (a `discordRoleId` column) for a more
  durable solution.
- **One Discord role per team, not per player.** The map resolves which team
  a Discord user captains; pick turn enforcement (A vs B) remains a runtime
  lookup based on `Match.homeTeamId` / `Match.awayTeamId`.
- **Draft `captainAKey` and match `homeTeamCaptainKey` are separate.** These are separate
  UUID auth tokens on separate records. Discord OAuth replaces both with
  a single identity -> team -> role -> draft-slot lookup.

### Implementation Status

Discord OAuth is fully implemented as of this update:
- Login/logout/session: `GET /api/auth/discord`, `GET /api/auth/discord/callback`, `POST /api/auth/discord/logout`, `GET /api/auth/discord/me`
- Core library: `lib/discordAuth.js` (session management, role resolution)
- Unified auth: `lib/resolveAuth.js` (resolveMatchCaptainAuth, resolveDraftCaptainAuth, resolveAdminAuth)
- All captain-facing routes accept Discord OAuth as primary auth with key-based fallback
- 56 tests covering all authorization scenarios

Graceful degradation: If Discord env vars are not configured, OAuth routes return HTTP 503 but all existing key-based auth continues to function normally.

---

## 8. Route Authorization Matrix

### Current auth mechanisms

| Mechanism | How it works |
|---|---|
| `requireAdmin` | HMAC-signed session cookie (`ADMIN_SESSION_SECRET`) |
| `resolveRole(key, draft)` | URL/body `key` matched against `Draft.adminKey / captainAKey / captainBKey` |
| `resolveCaptainSide(match, captainKey)` | `X-Captain-Key` header matched against `Match.homeTeamCaptainKey / awayTeamCaptainKey` |
| Public | No auth, read-only |

### Per-route matrix

| Route | File | Current auth | Can captain self-serve? | Discord OAuth change needed |
|---|---|---|---|---|
| Match page captain entry | `app/matches/[id]/page.js` | `?key=<matchCaptainKey>` URL param | Partial (sees match, but draft link goes to spectator) | Lookup `Draft.captainA/BKey` server-side, surface correct URL |
| GodDraft ready-up | `app/api/drafts/[id]/ready/route.js` | `body.key` via `resolveRole` | ✅ Yes (once URL is correct) | Replace key lookup with Discord identity → team → draft slot |
| GodDraft ban (POST) | `app/api/drafts/[id]/ban/route.js` | `body.key` via `resolveRole` | ✅ Yes (turn-enforced) | Same as above |
| GodDraft ban (DELETE/undo) | `app/api/drafts/[id]/ban/route.js` | `resolveRole` → must be `admin` | ❌ Admin only | No change |
| GodDraft pick (POST) | `app/api/drafts/[id]/pick/route.js` | `body.key` via `resolveRole` | ✅ Yes (turn-enforced) | Same as ready-up |
| GodDraft pick (DELETE/undo) | `app/api/drafts/[id]/pick/route.js` | `resolveRole` → must be `admin` | ❌ Admin only | No change |
| GodDraft admin actions (nextGame, reset, reopen) | `app/api/drafts/[id]/admin/route.js` | `resolveRole` → must be `admin` | ❌ Admin only | No change |
| Match submissions (POST) | `app/api/matches/[id]/submissions/route.js` | `X-Captain-Key` header + window check | ✅ Yes | Discord identity → `captainSide` resolver |
| Reschedule request (POST) | `app/api/matches/[id]/reschedule-requests/route.js` | `X-Captain-Key` header | ✅ Yes | Discord identity → `captainSide` resolver |
| Reschedule request (PATCH / respond) | `app/api/matches/[id]/reschedule-requests/[reqId]/route.js` | `X-Captain-Key` header | ✅ Yes (opposing captain) | Same |
| Reschedule request (GET) | `app/api/matches/[id]/reschedule-requests/route.js` | `requireAdmin` | ❌ Admin only | No change |
| OCR screenshot upload | `app/api/ocr/extract/route.js` | `X-Captain-Key` header | ✅ Yes | Discord identity → `captainSide` resolver |
| PlayerDraft pick | `app/api/player-drafts/[id]/pick/route.js` | `requireAdmin` | ❌ Admin only | Requires schema migration + new captain-key concept on `PlayerDraft` |
| PlayerDraft lifecycle (start/pause/undo) | `app/api/player-drafts/[id]/route.js` | `requireAdmin` | ❌ Admin only | Remains admin-only |

### Discord OAuth implementation pattern (when pursued)

The cleanest approach is a new server-side resolver:

```js
// lib/discordAuth.js (does not exist yet — design only)
async function resolveRoleFromDiscord(discordUserId, context) {
  // 1. Fetch guild member roles from Discord API
  // 2. Check DISCORD_TEAM_ROLE_MAP_JSON for a matching team
  // 3. For GodDraft: look up which team is captainA/B in this draft
  // 4. Return 'admin' | 'captainA' | 'captainB' | 'spectator'
}
```

This runs alongside (not replacing) the existing key-based `resolveRole` so
both auth paths work simultaneously during rollout.

### Implementation risks

| Risk | Severity | Mitigation |
|---|---|---|
| Team IDs not yet in DB | 🔴 Blocker | Create teams first, then query IDs |
| Draft `captainA/BKey` ≠ match captain key | 🟡 Medium | Need a DB join; cannot use a static env var mapping |
| `DISCORD_TEAM_ROLE_MAP_JSON` is per-season | 🟡 Medium | Consider storing `discordRoleId` on the `Team` row instead |
| GodDraft key-based auth is on 5 routes simultaneously | 🟡 Medium | Use a compat shim (accept key OR Discord token) during rollout |
| PlayerDraft has no captain-key concept | 🟡 Medium | Requires schema migration before Discord OAuth can apply |
| Discord OAuth redirect URI per-environment | 🟢 Low | Vercel preview deployments each need their own redirect URI registered |

---

## 9. npm Scripts Reference

```bash
npm run dev              # Next.js dev server
npm run build            # Production build (uses fake DB URL in CI)
npm run lint             # next lint
npm run test             # vitest run — all unit + API tests (172 tests)
npm run test:unit        # vitest run tests/unit
npm run test:api         # vitest run tests/api
npm run test:e2e         # playwright test (requires running app)
npm run test:coverage    # vitest run --coverage
npm run verify:draft     # lint + test + build — use before every deploy

npm run db:generate      # prisma generate
npm run db:migrate:dev   # prisma migrate dev
npm run db:migrate:deploy # prisma migrate deploy
npm run db:seed          # node prisma/seed.mjs
npm run db:reset         # prisma migrate reset --force (drops + re-migrates + seeds)
npm run db:studio        # prisma studio
```

`npm run verify:draft` is the canonical pre-deploy confidence check. It must
pass clean before any code is pushed to production.

---

## 10. Pre-Match-Night Checklist

Use this before every match night until the workflow gaps above are resolved.

### Before match night (admin)

- [ ] Teams created in DB for the season (check `/api/teams`)
- [ ] Match scheduled in admin Schedule tab (`POST /api/matches`)
- [ ] For each game in the match: click "Open Draft" in the Schedule tab
- [ ] For each game's draft: open the Drafts tab → Share modal → copy Captain A
  and Captain B links
- [ ] Send Captain A link privately to home team captain
- [ ] Send Captain B link privately to away team captain
- [ ] Send match page URL `https://HOST/matches/[id]?key=<homeTeamCaptainKey>`
  to home team captain
- [ ] Send match page URL `https://HOST/matches/[id]?key=<awayTeamCaptainKey>`
  to away team captain
- [ ] Set match `status: live` in admin Schedule tab dropdown

### During match (captains, self-service after links are shared)

- [ ] Both captains navigate to their draft link
- [ ] Both captains click "Ready Up" in the lobby
- [ ] Draft auto-transitions to banning
- [ ] Captains complete all 6 bans (alternating, turn-enforced)
- [ ] Draft auto-transitions to picking
- [ ] Captains complete all 10 picks (ABBA order, turn-enforced)
- [ ] Draft shows "complete"

### After each game (captain)

- [ ] Captain navigates to match page `?key=<matchCaptainKey>`
- [ ] Uploads Details tab screenshot for the completed game
- [ ] Confirms "Screenshot submitted — awaiting admin review"

### After each game (admin)

- [ ] Review submission in Admin → Review Queue tab
- [ ] Approve submission → `Game.winnerTeamId` set automatically
- [ ] If BO3/BO5 and series not over: click "Open Draft" for next game
- [ ] Share new captain links for next game draft

### After match (admin)

- [ ] Verify all game winners set correctly in Schedule tab
- [ ] Set match `status: completed` in dropdown
- [ ] Standings recompute automatically on next request

---

*Document generated from session audit on 2026-05-26. Update this file
whenever confirmed bugs are fixed, workflow gaps are closed, or team/discord
IDs are finalized.*
