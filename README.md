# Frank's Retirement Home — Smite 2 League Ops Platform

FRH is a League Ops platform for competitive Smite 2 communities.

The platform now supports:

- Persistent seasons and divisions
- Teams and roster management
- Match scheduling
- Match-bound drafts
- Standalone drafts
- Human-reviewed OCR stat ingestion
- Public standings and league pages
- Admin operational tooling

FRH is the canonical source of truth for league operations.

---

## Current Product Priorities

1. League Ops reliability
2. Match-bound draft integrity
3. Human-reviewed OCR ingestion
4. Review queue correctness
5. Standings accuracy
6. Public league UX
7. Standalone draft preservation

---

## Architecture Summary

| Layer | Responsibility |
|---|---|
| FRH | Canonical source of truth |
| Prisma + Neon | Primary persistence layer |
| Gemini (`lib/gemini.js`) | OCR extraction |
| Review Queue | Human approval boundary |
| CSV/Excel | Operational export/import layer |
| Standalone Drafts | Scrims/testing fallback |

---

## Draft Systems

FRH contains two separate draft systems:

| System | Purpose |
|---|---|
| GodDraft | Per-game god pick/ban flow |
| PlayerDraft | Seasonal roster drafting |

See `docs/draft-architecture.md` for canonical behavior.

---

## OCR + Review Queue

OCR extraction is performed directly by FRH through `lib/gemini.js`.

Important rules:

- OCR results are never canonical automatically.
- Human review is mandatory.
- Public routes never read staging tables.
- Match submissions must continue functioning even if OCR fails.

See:

- `docs/review-queue-policy.md`
- `docs/forgelens-worker-architecture.md`

---

## League Ops Policies

| Document | Purpose |
|---|---|
| `docs/review-queue-policy.md` | Human approval rules + staging boundaries |
| `docs/forgelens-worker-architecture.md` | Native Gemini OCR architecture |
| `docs/season-9-migration-runbook.md` | Migration sequencing + operational safeguards |
| `docs/draft-architecture.md` | Draft system boundaries + invariants |
| `docs/season-9-backlog.md` | Historical S9 planning reference |

---

## Security Notes

- Public draft APIs must never expose admin/captain keys.
- Review queue actions remain admin-only.
- OCR data remains staging-only until approval.

---

## Development

```bash
npm install
npm run db:reset   # resets DB, applies migrations, seeds mock data
npm run dev
```

---

## Discord OAuth Setup

FRH uses Discord OAuth as the primary authentication path for captains and admins. Existing key-based captain links remain as a fallback.

### Prerequisites

1. A Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
2. A Discord server (guild) with configured roles

### Discord Developer Portal Setup

1. Create a new application (or use existing) at https://discord.com/developers/applications
2. Go to **OAuth2** tab
3. Copy the **Client ID** and **Client Secret**
4. Add redirect URIs:
   - Local development: `http://localhost:3000/api/auth/discord/callback`
   - Production: `https://YOUR_VERCEL_DOMAIN/api/auth/discord/callback`
   - Vercel preview deploys: `https://*.vercel.app/api/auth/discord/callback`

### Discord Server Roles

Create these roles in your Discord server:

| Role | Purpose |
|------|---------|
| Admin | Full admin access to FRH dashboard and admin APIs |
| Captain | Generic captain role (all team captains must have this) |
| Hospice | Division role for Hospice division captains |
| Rehabilitation | Division role for Rehabilitation division captains |
| Per-team roles (10) | One role per team for team-specific authorization |

### Retrieving Discord Role IDs

1. Enable Developer Mode: Discord Settings > Advanced > Developer Mode
2. Go to Server Settings > Roles
3. Right-click each role > Copy Role ID

### Environment Variables

Copy `.env.example` to `.env.local` and fill in all Discord values. See the file for detailed comments.

### DISCORD_TEAM_ROLE_MAP_JSON

This maps FRH team IDs to Discord role IDs:

```json
{
  "team-galactic-stingers": "DISCORD_ROLE_ID_HERE",
  "team-caustic-crusaders": "DISCORD_ROLE_ID_HERE",
  "team-death-dealers": "DISCORD_ROLE_ID_HERE",
  "team-wheezys-mafia": "DISCORD_ROLE_ID_HERE",
  "team-ruined-order": "DISCORD_ROLE_ID_HERE",
  "team-kappa-corp": "DISCORD_ROLE_ID_HERE",
  "team-exile-extinction": "DISCORD_ROLE_ID_HERE",
  "team-valhalla-vikings": "DISCORD_ROLE_ID_HERE",
  "team-babas-kitchen": "DISCORD_ROLE_ID_HERE",
  "team-cyberpunk-otters": "DISCORD_ROLE_ID_HERE"
}
```

### Vercel Deployment

Set all Discord env vars in Vercel > Project Settings > Environment Variables:
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET
- DISCORD_GUILD_ID
- DISCORD_SESSION_SECRET
- DISCORD_ADMIN_ROLE_ID
- DISCORD_HOSPICE_CAPTAIN_ROLE_ID
- DISCORD_REHABILITATION_CAPTAIN_ROLE_ID
- DISCORD_HOSPICE_PLAYER_ROLE_IDS
- DISCORD_REHABILITATION_PLAYER_ROLE_IDS
- DISCORD_TEAM_ROLE_MAP_JSON
- NEXTAUTH_URL (set to your production domain)

### Auth Behavior

- Discord OAuth is the primary auth path when configured
- If Discord env vars are missing, OAuth routes return 503 but the app continues to work
- Existing captain keys (X-Captain-Key header, URL ?key= params) remain as fallback
- Admin session cookies continue to work alongside Discord admin role

### Routes Supporting Discord OAuth (Captain)

- Match result report/confirm/dispute
- Match submissions / screenshot upload
- GodDraft ready, ban, pick
- Reschedule request creation and response
- OCR extraction upload

### Routes Remaining Admin-Only

- Admin dashboard
- GodDraft undo/reset/reopen
- PlayerDraft lifecycle
- Match scheduling/editing/deleting

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js |
| ORM | Prisma |
| Database | Neon PostgreSQL |
| Realtime | SSE |
| OCR | Gemini Vision |
| Hosting | Vercel / Node hosts |

---

## Historical Context

FRH originally began as a standalone draft-room project.

Season 9 expanded the platform into a full League Ops system with:

- persistent organizations
- divisions
- schedules
- standings
- OCR ingestion
- review queues
- match lifecycle tooling

Some older docs and issues may still reference earlier ForgeLens worker planning. Current architecture is FRH-native OCR via `lib/gemini.js`.
