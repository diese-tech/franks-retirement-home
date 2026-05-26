# Season 9 Migration Runbook

**Status: Binding operational guide.**

This runbook documents the Prisma migration sequence for Season 9 models. Each step includes a pre-migration check, the migration command, a post-migration verification query, and a rollback plan.

**Non-negotiable rule: mid-season migrations are additive only.** Once Season 9 is live (i.e., any match has been played and approved), no migration may drop a column, drop a table, remove a unique index, or change a NOT NULL constraint. Only `CREATE TABLE`, `ADD COLUMN` (nullable), and new index additions are permitted mid-season.

The one destructive step in this runbook (`DraftPick.playerId` nullable) is explicitly flagged as **pre-season only** and must not be run after the first approved match result.

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

---

## Step 1 — Season + Division + Org + Team + TeamMember

**Backlog issue:** #67 (supersedes #41)
**Status:** Complete — migration applied and seeded.

**Pre-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
```
Confirm that `Season`, `Division`, `Org`, `Team`, `TeamMember` do not exist before running.

**Command:**
```bash
npx prisma migrate dev --name add-season-roster-foundation
```

**Post-check:**
```sql
SELECT id, name, slug, status FROM "Season";
-- Expect: season-9, Season 9, s9, upcoming

SELECT id, name, tier FROM "Division" WHERE "seasonId" = 'season-9';
-- Expect: Hospice (tier 1), Rehabilitation (tier 2)
```

**Rollback plan:** Drop `TeamMember`, `Team`, `Org`, `Division`, `Season` in reverse order. This is safe pre-season because no match or draft data references these tables yet. After any match data exists, rolling back is destructive and requires a database restore.

---

## Step 2 — Match + Game

**Backlog issue:** #70 (supersedes #45)

**Pre-check:**
Confirm Step 1 is complete. Check `Team` rows exist (at least two teams needed to schedule a match).
```sql
SELECT COUNT(*) FROM "Team";
```

**Command:**
```bash
npx prisma migrate dev --name add-match-game
```

**Post-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('Match', 'Game');
-- Expect both tables to appear

-- Verify unique constraint on Game(matchId, gameNumber):
\d "Game"
```

**Rollback plan:** Drop `Game`, then `Match`. Safe pre-season. After any approved match result exists, rolling back requires a full database restore.

---

## Step 3 — Draft.gameId nullable FK to Game

**Backlog issue:** #72 (supersedes #49)

**Pre-check:**
Confirm Step 2 is complete.
```sql
SELECT id, name, status FROM "Match" LIMIT 5;
```
Confirm that the `Draft` table exists and has rows with `gameId IS NULL` (existing standalone drafts).

**Command:**
```bash
npx prisma migrate dev --name add-draft-gameid-fk
```

**Post-check:**
```sql
-- Existing standalone drafts must still have gameId = NULL
SELECT COUNT(*) FROM "Draft" WHERE "gameId" IS NULL;
-- Must match the count before migration

-- The column should exist and be nullable
SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'Draft' AND column_name = 'gameId';
```

**Rollback plan:** `ALTER TABLE "Draft" DROP COLUMN "gameId"`. Safe at any time — the column starts null and no production queries depend on it yet. After match-bound drafts exist, dropping it orphans draft-game bindings; restore from backup instead.

---

## Step 4 — PlayerDraft + PlayerDraftPick

**Backlog issue:** #75

**Pre-check:**
Confirm Step 1 is complete (Season, Division, Team, Player all exist).
```sql
SELECT COUNT(*) FROM "Season";
SELECT COUNT(*) FROM "Division";
SELECT COUNT(*) FROM "Team";
SELECT COUNT(*) FROM "Player";
```

**Command:**
```bash
npx prisma migrate dev --name add-player-draft
```

**Post-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('PlayerDraft', 'PlayerDraftPick');
-- Expect both tables to appear

-- Verify unique constraint on PlayerDraft(seasonId, divisionId):
\d "PlayerDraft"
```

**Rollback plan:** Drop `PlayerDraftPick`, then `PlayerDraft`. Safe pre-player-draft. After any picks have been recorded, dropping these tables destroys draft history; restore from backup.

---

## Step 5 — DraftPick.playerId nullable (**PRE-SEASON ONLY**)

**Backlog issue:** #74 (supersedes #51)

> **WARNING: DESTRUCTIVE — PRE-SEASON ONLY.**
> This step makes `DraftPick.playerId` nullable and drops/relaxes the `@@unique([draftId, playerId])` constraint. It must NOT be run after any match has been played with linked DraftPick records. Dropping the unique constraint can silently allow duplicate player entries on existing drafts if the application logic is not updated first.

**Pre-check:**
```sql
-- Verify no approved matches exist
SELECT COUNT(*) FROM "Match" WHERE status = 'completed';
-- Must be 0

-- Confirm current DraftPick rows:
SELECT COUNT(*), COUNT("playerId") as with_player FROM "DraftPick";
```

**Command:**
```bash
npx prisma migrate dev --name relax-draftpick-playerid
```

Prisma will emit a warning about a destructive change. Confirm it.

**Post-check:**
```sql
-- playerId must now allow NULL
SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'DraftPick' AND column_name = 'playerId';
-- Expect: is_nullable = YES

-- Existing picks must be undamaged
SELECT COUNT(*) FROM "DraftPick" WHERE "playerId" IS NOT NULL;
-- Must equal the original with_player count from pre-check
```

**Rollback plan:** Restore from a pre-migration backup. There is no safe in-place rollback for making a column NOT NULL again if any null rows have been written. Take a database snapshot before running this step.

---

## Step 6 — MatchSubmission + SubmissionAttachment

**Backlog issue:** #52

**Pre-check:**
Confirm Step 2 (Match, Game) is complete.

**Command:**
```bash
npx prisma migrate dev --name add-match-submission
```

**Post-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('MatchSubmission', 'SubmissionAttachment');
```

**Rollback plan:** Drop `SubmissionAttachment`, then `MatchSubmission`. Safe pre-season.

---

## Step 7 — StatLine

**Backlog issue:** #54

**Pre-check:**
Confirm Steps 2 and 6 are complete.

**Command:**
```bash
npx prisma migrate dev --name add-statline
```

**Post-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'StatLine';
```

**Rollback plan:** Drop `StatLine`. Safe if no approved matches exist. After approved stats exist, rolling back destroys the canonical stat record; restore from backup.

---

## Step 8 — OcrExtraction + ExtractedStatLine + PlayerAlias

**Backlog issue:** #63

**Pre-check:**
Confirm Steps 6 and 7 are complete. These are staging/auxiliary tables; the sequence matters less than the canonical tables, but all canonical table deps must be present.

**Command:**
```bash
npx prisma migrate dev --name add-forgelens-staging
```

**Post-check:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('OcrExtraction', 'ExtractedStatLine', 'PlayerAlias');
```

**Rollback plan:** Drop `ExtractedStatLine`, `OcrExtraction`, `PlayerAlias`. These are staging tables; data loss is not catastrophic because they contain unreviewed OCR output, not canonical stats. However, any pending extractions awaiting review will be lost.

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

- The `directUrl` env var for migration operations (bypasses connection pooling)
- Point-in-time restore via the Neon dashboard

**Important:** FRH does **not** use a Prisma migrations folder. `prisma/schema.prisma` is the source of truth. All schema changes are applied via:

```bash
npm run db:push
# equivalent to: DATABASE_URL=... DIRECT_URL=... npx prisma db push
```

`DIRECT_URL` must be the non-pooled Neon connection string. `db push` requires a direct connection to apply DDL changes. If the deployment environment cannot reach Neon (e.g., Vercel's build sandbox), run `npm run db:push` from a local terminal with the production env vars set, or use the Neon console.

Do **not** use `prisma migrate dev` or `prisma migrate deploy` — they expect a migration folder that does not exist.

---

## Post-S9-launch additive changes

The following columns were added after the initial S9 schema was pushed to production. They are additive and safe to apply mid-season.

### Player model additions (PR #82)

```
Player.timezone       String?           -- nullable, default null
Player.secondaryRoles String[]          -- default []
```

Applied via `npm run db:push`. No data loss. Existing rows get `null` / `[]`.

---

## Cross-references

- `docs/review-queue-policy.md` — approval policies that these tables enforce
- `docs/forgelens-worker-architecture.md` — contract for ForgeLens integration (Steps 8+)
- `docs/season-9-backlog.md` — issue mapping and milestone plan
