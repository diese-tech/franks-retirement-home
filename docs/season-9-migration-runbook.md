# Season 9 Migration Runbook

**Status: Binding operational guide.**

This runbook documents the Prisma migration sequence for Season 9 models. Each step includes a pre-migration check, the migration command, a post-migration verification query, and a rollback plan.

**Non-negotiable rule: mid-season migrations are additive only.** Once Season 9 is live (i.e., any match has been played and approved), no migration may drop a column, drop a table, remove a unique index, or change a NOT NULL constraint. Only `CREATE TABLE`, `ADD COLUMN` (nullable), and new index additions are permitted mid-season.

The one destructive step in this runbook (`DraftPick.playerId` nullable) is explicitly flagged as **pre-season only** and must not be run after the first approved match result.

---

## Current migration state

FRH now uses **Prisma Migrate**. The `prisma/migrations/` folder is committed to the repository and is the authoritative source of schema history.

**Do not use `prisma db push`** — it bypasses migration tracking and breaks `prisma migrate deploy`.

The initial migration `20250526000000_init` contains the complete schema for all Season 9 tables. All prior steps in this runbook (Steps 1–8 below) are now captured in that single initial migration, which was applied via:

```bash
npm run db:reset
# equivalent to: prisma migrate reset --force && node prisma/seed.mjs
```

### Adding future schema changes

```bash
# Edit prisma/schema.prisma, then:
npm run db:migrate:dev -- --name describe-your-change
# Commit the generated prisma/migrations/<timestamp>_<name>/migration.sql
```

### Deploying migrations to production

```bash
# Applied automatically by GitHub Actions on push to main, or manually:
npx prisma migrate deploy
```

---

## Migration dependency order

```
Season
  └── Division (depends on Season)
Org  (standalone display entity, no deps)
Team  (depends on Season, Division; display-dep on Org)
TeamMember  (depends on Team, Player)

Match  (depends on Season, Division, Team)
Game   (depends on Match)

Draft.gameId nullable FK  (depends on Game)

PlayerDraft  (depends on Season, Division)
PlayerDraftPick  (depends on PlayerDraft, Team, Player)

MatchSubmission  (depends on Match, Game, Player)
SubmissionAttachment  (depends on MatchSubmission)
StatLine  (depends on Game, Team, Player, God)
OcrExtraction  (depends on SubmissionAttachment)
ExtractedStatLine  (depends on OcrExtraction, Game, Team, God)
PlayerAlias  (depends on Player)
```

All of the above are included in `20250526000000_init`.

---

## Step 1 — Season + Division + Org + Team + TeamMember

**Status:** ✅ Complete — included in `20250526000000_init`.

**Post-check:**
```sql
SELECT id, name, slug, status FROM "Season";
-- Expect: season-9, Season 9, s9, upcoming

SELECT id, name, tier FROM "Division" WHERE "seasonId" = 'season-9';
-- Expect: Hospice (tier 1), Rehabilitation (tier 2)
```

**Rollback plan:** Drop `TeamMember`, `Team`, `Org`, `Division`, `Season` in reverse order. Safe pre-season because no match or draft data references these tables yet. After any match data exists, rolling back is destructive and requires a database restore.

---

## Step 2 — Match + Game

**Status:** ✅ Complete — included in `20250526000000_init`.

**Post-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('Match', 'Game');
-- Expect both tables to appear

\d "Game"
-- Verify unique constraint on (matchId, gameNumber)
```

**Rollback plan:** Drop `Game`, then `Match`. Safe pre-season. After any approved match result exists, rolling back requires a full database restore.

---

## Step 3 — Draft.gameId nullable FK to Game

**Status:** ✅ Complete — included in `20250526000000_init`.

**Post-check:**
```sql
SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'Draft' AND column_name = 'gameId';
-- Expect: is_nullable = YES
```

**Rollback plan:** `ALTER TABLE "Draft" DROP COLUMN "gameId"`. Safe at any time — the column starts null. After match-bound drafts exist, dropping it orphans draft-game bindings; restore from backup instead.

---

## Step 4 — PlayerDraft + PlayerDraftPick

**Status:** ✅ Complete — included in `20250526000000_init`.

**Post-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('PlayerDraft', 'PlayerDraftPick');
-- Expect both tables to appear

\d "PlayerDraft"
-- Verify unique constraint on (seasonId, divisionId)
```

**Rollback plan:** Drop `PlayerDraftPick`, then `PlayerDraft`. Safe pre-player-draft. After any picks have been recorded, dropping these tables destroys draft history; restore from backup.

---

## Step 5 — DraftPick.playerId nullable (**PRE-SEASON ONLY**)

**Status:** ✅ Complete — included in `20250526000000_init`.

> **WARNING: DESTRUCTIVE — PRE-SEASON ONLY.**
> This step makes `DraftPick.playerId` nullable and relaxes the `@@unique([draftId, playerId])` constraint. It must NOT be run after any match has been played with linked DraftPick records.

**Post-check:**
```sql
SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'DraftPick' AND column_name = 'playerId';
-- Expect: is_nullable = YES
```

**Rollback plan:** Restore from a pre-migration backup. There is no safe in-place rollback for making a column NOT NULL again if any null rows have been written.

---

## Step 6 — MatchSubmission + SubmissionAttachment

**Status:** ✅ Complete — included in `20250526000000_init`.

**Post-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('MatchSubmission', 'SubmissionAttachment');
```

**Rollback plan:** Drop `SubmissionAttachment`, then `MatchSubmission`. Safe pre-season.

---

## Step 7 — StatLine

**Status:** ✅ Complete — included in `20250526000000_init`.

**Post-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'StatLine';
```

**Rollback plan:** Drop `StatLine`. Safe if no approved matches exist. After approved stats exist, rolling back destroys the canonical stat record; restore from backup.

---

## Step 8 — OcrExtraction + ExtractedStatLine + PlayerAlias

**Status:** ✅ Complete — included in `20250526000000_init`.

**Post-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('OcrExtraction', 'ExtractedStatLine', 'PlayerAlias');
```

**Rollback plan:** Drop `ExtractedStatLine`, `OcrExtraction`, `PlayerAlias`. These are staging tables; data loss is not catastrophic because they contain unreviewed OCR output, not canonical stats.

---

## Mid-season migration checklist

If a migration must be applied during an active season (after any match has been played), it must satisfy all of the following before deployment:

- [ ] The migration adds only new tables or nullable columns.
- [ ] No existing column is altered (type change, nullability change, rename).
- [ ] No index or constraint is dropped.
- [ ] No existing table is dropped.
- [ ] The Prisma generate output shows no implicit changes to existing models (check the diff carefully).
- [ ] A point-in-time snapshot of the production database has been taken within the last 24 hours.
- [ ] The migration has been tested on a copy of the production database with representative data.

If any of these conditions is not met, the migration is not safe for mid-season deployment.

---

## Neon-specific notes

FRH uses Neon PostgreSQL. Neon supports:

- The `directUrl` env var for migration operations (bypasses connection pooling) — set as `DIRECT_URL` in `.env` / Vercel env vars
- Point-in-time restore via the Neon dashboard

`prisma migrate deploy` and `prisma migrate reset` both use `DIRECT_URL` (the non-pooled connection string). `DATABASE_URL` uses the pooler and is used only at runtime by the Next.js app.

---

## Post-S9-launch additive changes

Future additive changes go here. Each entry should include:
- The issue/PR number
- The migration name created by `prisma migrate dev`
- A post-check SQL query
- Whether it is mid-season safe

---

## Cross-references

- `docs/DEPLOYMENT_NOTES.md` — deployment workflow and Vercel env var reference
- `docs/review-queue-policy.md` — approval policies that these tables enforce
- `docs/forgelens-worker-architecture.md` — contract for ForgeLens integration (Steps 8+)
- `docs/season-9-backlog.md` — issue mapping and milestone plan
