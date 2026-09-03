# Frank's Retirement Home

**Frank's Retirement Home (FRH)** is a league-operations platform for competitive **SMITE 2** communities.

It combines season and roster management, scheduling, drafting, human-reviewed stat ingestion, standings, tournament tools, public league pages, and admin workflows in one application.

> **Status:** Active production-oriented development. FRH is the canonical source of truth for its league operations and is deployed as a full web platform rather than a standalone draft-room experiment.

## What FRH Does

### League operations

- Persistent seasons and divisions
- Team and roster management
- Match scheduling and result workflows
- Standings and public league pages
- Admin operational tooling
- Discord OAuth for captain/admin identity where configured

### Drafting

FRH contains two intentionally separate draft systems:

- **GodDraft** — per-game god pick/ban flow
- **PlayerDraft** — seasonal roster drafting

See [`docs/draft-architecture.md`](docs/draft-architecture.md) for the authoritative boundaries and invariants.

### Stats and evidence

- Human-reviewed OCR/stat ingestion
- Review queue for staging extracted data before publication
- Direct Gemini-based extraction plus supported ForgeLens callback integration
- Public routes separated from unapproved staging data
- Match submission designed to remain usable even when OCR fails

### Tournament and community features

- Standalone real-time tournament brackets
- Bulletin/community surfaces
- Fraud-watch workflows
- Community prediction/points features where enabled

## Architecture

| Layer | Responsibility |
| --- | --- |
| FRH application | Canonical league operations and public/admin UI |
| Prisma + Supabase PostgreSQL | Primary persistence |
| Gemini Vision | OCR extraction support |
| Review queue | Human approval boundary |
| CSV/Excel | Operational import/export |
| Vercel | Application hosting |

FRH treats extracted OCR data as **staging**, not automatic truth. Human review remains the approval boundary before stats become canonical.

## Quick Start

### Local development

```bash
npm install
npm run db:reset
npm run dev
```

For a fresh environment, Supabase setup, connection strings, Discord OAuth, and deployment prerequisites, start with [`docs/SETUP.md`](docs/SETUP.md).

## Production and Database Safety

FRH uses Prisma against Supabase PostgreSQL. Shared/production schema changes should follow the repository's migration policy rather than ad-hoc `db push` workflows.

Useful operational checks include:

```bash
npm run verify:env
node scripts/verify-db.mjs
npx prisma migrate status
```

For migration policy and recovery procedures, use:

- [`docs/PRISMA_WORKFLOW.md`](docs/PRISMA_WORKFLOW.md)
- [`docs/RECOVERY.md`](docs/RECOVERY.md)
- [`docs/DEPLOYMENT_NOTES.md`](docs/DEPLOYMENT_NOTES.md)

Do not use the README as the authoritative recovery runbook; production procedures belong in those documents so they can evolve without overwhelming the project front page.

## Documentation

Start here:

- [`docs/SETUP.md`](docs/SETUP.md) — fresh environment setup
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture
- [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md) — launch and operational verification
- [`docs/PRISMA_WORKFLOW.md`](docs/PRISMA_WORKFLOW.md) — database migration policy
- [`docs/RECOVERY.md`](docs/RECOVERY.md) — recovery procedures
- [`docs/draft-architecture.md`](docs/draft-architecture.md) — draft system boundaries
- [`docs/review-queue-policy.md`](docs/review-queue-policy.md) — OCR/review approval rules
- [`docs/league-ops-lifecycle.md`](docs/league-ops-lifecycle.md) — season lifecycle doctrine
- [`docs/adr/`](docs/adr/) — architecture decisions

Historical planning and season-specific material remain under `docs/` for context but should not override newer architecture/runbook documents when they conflict.

## Security and Data Boundaries

- Public APIs must never expose admin or captain secrets.
- Review-queue mutations remain explicitly authorized.
- OCR output remains staging-only until approved.
- Discord OAuth is the preferred identity path where configured; fallback credentials should not be expanded casually.
- Production database changes require migration discipline and environment verification.

## Tech Stack

- Next.js
- Prisma
- Supabase PostgreSQL
- Gemini Vision
- Discord OAuth
- Server-Sent Events
- Vercel

## Project Direction

FRH began as a draft-room project and evolved into a broader league-operations platform. Current work prioritizes operational reliability, draft integrity, review correctness, standings accuracy, and public league UX over adding unrelated features.
