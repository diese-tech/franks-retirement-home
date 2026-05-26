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
