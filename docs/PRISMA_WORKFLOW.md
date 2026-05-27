# FRH — Prisma Workflow Policy

**Status: Binding — applies to all contributors and all environments.**

This document defines the authoritative Prisma workflow for Frank's Retirement Home. It exists because a previous period of mixed `prisma db push` / `prisma migrate` usage against the production database caused schema drift that broke `prisma migrate deploy`. This policy prevents that from recurring.

---

## Background: what went wrong

`prisma db push` applies schema changes directly to the database without creating migration files or updating the `_prisma_migrations` table. When `prisma migrate deploy` is later run, Prisma compares the current database schema against the migration history and detects a discrepancy — a "drift" error — because changes applied via `db push` are invisible to the migration system.

The result: `prisma migrate deploy` fails in CI and on production deploys until the drift is manually resolved.

**The fix:** `prisma db push` is now local-only, used only for rapid schema iteration during development. All changes going to any shared database must go through a migration file created by `prisma migrate dev`.

---

## The workflow

### Rule 1: `prisma db push` — local dev only

`prisma db push` is permitted **only** when:
- You are connecting to a local or personal development database
- You are iterating on a schema change and haven't finalised it yet
- The database has no data you care about keeping

`prisma db push` is **never** permitted against:
- The shared production Supabase database
- Any staging environment shared with other contributors
- Any database that has ever had `prisma migrate deploy` run against it

### Rule 2: every schema change going to any shared DB needs a migration file

Once you've finished iterating on a schema change locally with `db push`, convert it to a migration before opening a PR:

```bash
# 1. Make sure your local DB reflects your intended final schema
#    (it may already if you used db push to iterate)

# 2. Create the migration file
npm run db:migrate:dev -- --name describe-your-change
# This generates: prisma/migrations/<timestamp>_describe-your-change/migration.sql

# 3. Commit the migration file alongside your schema change
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add HomepageContent model"
```

The generated `.sql` file is the authoritative record of what changed. It must be committed. PRs that modify `prisma/schema.prisma` without a corresponding migration file in `prisma/migrations/` will not be merged.

### Rule 3: `prisma migrate deploy` deploys to production

Production migrations are applied automatically by the GitHub Actions `migrate` job on every push to `main`. The job runs:

```bash
npx prisma migrate deploy
```

This applies any migration files that haven't been applied yet (in order). It uses `DIRECT_URL` (Supabase Session mode, port 5432).

To apply migrations manually (e.g., hotfix or pre-deploy check):
```bash
# Requires DIRECT_URL set to your Supabase Session-mode connection string
npx prisma migrate deploy
```

### Rule 4: use DIRECT_URL for all migration commands

Migration commands must use `DIRECT_URL` (port 5432, Supabase Session mode). The pooled `DATABASE_URL` (port 6543, Transaction mode) does not support the persistent connections that Prisma's migration engine requires.

The `prisma/schema.prisma` datasource is already configured correctly:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // runtime app — Transaction mode (6543)
  directUrl = env("DIRECT_URL")     // Prisma CLI — Session mode (5432)
}
```

No code changes are needed — just ensure both env vars are set correctly.

---

## Command reference

| Command | When to use | Safe for production DB? |
|---|---|---|
| `npm run db:generate` | After any schema change, before running the app | ✅ (no DB writes) |
| `npm run db:migrate:dev` | Creating a migration file from local schema changes | ✅ (local only; creates `.sql` file) |
| `npm run db:migrate:deploy` | Applying pending migrations to any environment | ✅ Yes — this is the correct production path |
| `npm run db:seed` | Inserting seed data into a freshly migrated DB | ⚠️ Local only (will upsert on existing data) |
| `npm run db:reset` | Full local reset: drop + re-migrate + re-seed | ❌ Never — destructive, local dev only |
| `npx prisma db push` | Rapid local schema iteration | ❌ Never against shared DBs |
| `npm run db:studio` | Browse and edit DB data in a GUI | ⚠️ Be careful in production |

---

## Adding a schema change: step-by-step

### Recent schema changes

- **Removed**: `HomepageContent` model (the old admin-editable homepage content system has been replaced by a data-driven homepage)
- **Added**: `BulletinPost` model (community/editorial bulletin board system with post types, lifecycle states, and entity linking)

These changes were applied via `prisma db push` during active iteration per the project's iteration policy.

```bash
# 1. Edit prisma/schema.prisma

# 2. (Optional) Iterate locally with db push — fast, no migration file yet
npx prisma db push

# 3. Test your changes locally

# 4. When satisfied, create the migration file
npm run db:migrate:dev -- --name add-my-new-model

# 5. Verify the generated SQL is what you expect
cat prisma/migrations/<timestamp>_add-my-new-model/migration.sql

# 6. Run prisma generate to update the Prisma client
npm run db:generate

# 7. Run tests
npm run test

# 8. Commit schema + migration file together
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add my new model"

# 9. Open PR — CI will lint, build, and verify
# 10. On merge to main, CI automatically runs prisma migrate deploy
```

---

## Mid-season migration rules

Once Season 9 is live (any match has been played and approved), all migrations must be **additive only**:

✅ Permitted mid-season:
- `CREATE TABLE` (new tables)
- `ADD COLUMN` with a default value or nullable
- `CREATE INDEX`

❌ Not permitted mid-season:
- `DROP TABLE`
- `DROP COLUMN`
- `ALTER COLUMN` (type change, nullability change, rename)
- `DROP INDEX` or `DROP CONSTRAINT`

Violating this rule risks data loss on a live season. If a destructive change is truly necessary mid-season, it requires a database backup snapshot first and explicit sign-off.

See `docs/season-9-migration-runbook.md` for the mid-season migration checklist.

---

## Recovering from drift

If `prisma migrate deploy` fails with a drift error, it means the database schema differs from what the migration history records — typically caused by a previous `prisma db push` against the wrong database.

**Resolution:**

```bash
# 1. Inspect what Prisma thinks differs
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# 2. If the diff is trivial (e.g., only the HomepageContent table added via
#    db push), mark the drift as resolved by baselining:
npx prisma migrate resolve --applied <migration-name>

# 3. If the diff is complex, the safest path is:
#    a. Take a Supabase point-in-time backup
#    b. Run: npx prisma migrate reset --force  (on a staging copy)
#    c. Verify the result matches production
#    d. Apply to production carefully
```

If in doubt, **do not run `prisma migrate reset --force` on production**. Restore from backup instead.

---

## Environment variable summary

| Var | Port | Mode | Used by |
|---|---|---|---|
| `DATABASE_URL` | 6543 | Transaction (pooled) | Next.js app at runtime |
| `DIRECT_URL` | 5432 | Session (direct) | Prisma CLI: migrate, generate, studio |

Both are set in `.env.local` for local development, in Vercel Environment Variables for production, and as GitHub Actions secrets for the CI migration job.

See `.env.example` for the exact URL format.

---

## Supabase Connection Management

### Finding connection strings in the Supabase dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Settings > Database**
3. Under **Connection string**, select the **URI** tab
4. You will see two connection modes:
   - **Transaction mode (port 6543):** Use this for `DATABASE_URL`. This goes through Supavisor connection pooling and is what the Next.js app uses at runtime.
   - **Session mode (port 5432):** Use this for `DIRECT_URL`. This is a direct connection required by Prisma CLI commands (migrate, generate, studio).

### Verifying connection strings are correct

Run the environment verification script:

```bash
npm run verify:env
```

This checks:
- `DATABASE_URL` uses port 6543 (Transaction/pooled mode)
- `DIRECT_URL` uses port 5432 (Session/direct mode)
- Both URLs reference the same Supabase project-ref
- The project-ref format is valid

You can also manually inspect the URL structure:

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres  (DATABASE_URL)
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres  (DIRECT_URL)
```

### Port reference

| Port | Supavisor Mode | Prisma Usage | Env Var |
|---|---|---|---|
| 6543 | Transaction (pooled) | Runtime queries | `DATABASE_URL` |
| 5432 | Session (direct) | Migrations, generate, studio | `DIRECT_URL` |

**Transaction mode (6543)** pools connections and is suitable for serverless environments like Vercel where many short-lived function invocations share connections.

**Session mode (5432)** provides a direct, persistent connection. Prisma's migration engine requires this because it holds a connection open for the duration of the migration.

### Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Using port 5432 for `DATABASE_URL` | Works locally but connection exhaustion in production | Switch to port 6543 for `DATABASE_URL` |
| Using port 6543 for `DIRECT_URL` | `prisma migrate deploy` hangs or fails with timeout | Switch to port 5432 for `DIRECT_URL` |
| Wrong project-ref | P2021 errors (tables not found) | Verify project-ref matches your Supabase dashboard URL |
| Expired or rotated password | Connection refused / auth errors | Get new password from Supabase dashboard > Settings > Database |
| Mixing project-refs between vars | Migrations succeed but app queries wrong DB | Ensure both URLs use the same project-ref |

### Rotating database password without downtime

1. **Generate a new password** in Supabase dashboard > Settings > Database > Reset database password
2. **Update Vercel env vars immediately** -- both `DATABASE_URL` and `DIRECT_URL` must get the new password
3. **Update GitHub Actions secrets** if CI runs migrations (`DATABASE_URL` and `DIRECT_URL` secrets)
4. **Update `.env.local`** for local development
5. **Trigger a Vercel redeploy** to pick up the new env vars
6. **Verify** with `npm run verify:env` and `node scripts/verify-db.mjs`

Note: Supabase password rotation takes effect immediately. The old password stops working as soon as the new one is set. Update all consumers (Vercel, GitHub Actions, local) as quickly as possible to minimize downtime.
