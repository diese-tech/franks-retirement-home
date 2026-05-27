# Deployment Notes

Operational steps required when shipping recent changes. Append new sections at the top as more deployment-relevant work lands.

---

---

## Production Database Verification

Use the verification scripts to confirm that your production environment is correctly configured.

### Environment variable check (no DB connection)

```bash
# Validates URL formats, ports, project-ref consistency, and required vars
npm run verify:env
```

This runs `scripts/verify-env.mjs` which checks:
- `DATABASE_URL` is set and uses port 6543 (pooled/Transaction mode)
- `DIRECT_URL` is set and uses port 5432 (session/direct mode)
- Both URLs reference the same Supabase project-ref
- `ADMIN_SESSION_SECRET` is set and at least 16 characters
- Other critical variables (`ADMIN_PASSWORD`, `NEXTAUTH_URL`) are present

### Database connectivity check (read-only)

```bash
# Connects to the database and counts rows in critical tables
node scripts/verify-db.mjs
```

Expected output after a fresh seed:

| Table | Count |
|---|---|
| Season | 1 |
| Player | 20 |
| Team | 10 |
| Division | 2 |
| God | 83 |
| HomepageContent | 0 (created on first admin edit) |

### Diagnosing P2021 "table does not exist" errors

If the application throws `P2021` (The table `public.TableName` does not exist in the current database), follow these steps:

1. **Confirm migrations are deployed.** Run `npx prisma migrate status` against the production database. If there are pending migrations, run `npx prisma migrate deploy`.

2. **Confirm the correct Supabase project.** Extract the project-ref from your `DATABASE_URL` and verify it matches the project in your Supabase dashboard. A common cause is env vars pointing to the wrong project after a migration.

3. **Run the DB verification script.** Use `node scripts/verify-db.mjs` to confirm which tables are accessible. If all return errors, the connection string itself is wrong. If specific tables are missing, migrations are incomplete.

4. **Check Vercel env vars match your Supabase project.** In Vercel > Project > Settings > Environment Variables, verify:
   - `DATABASE_URL` uses port 6543 and the correct project-ref
   - `DIRECT_URL` uses port 5432 and the same project-ref
   - Both use the same password (the one from your Supabase project settings)

5. **Re-run migrations if needed:**
   ```bash
   # With production DIRECT_URL set:
   npx prisma migrate deploy
   ```

### Vercel environment variable verification checklist

Before each production deploy, confirm in Vercel > Project > Settings > Environment Variables:

- [ ] `DATABASE_URL` - Supabase Transaction URL, port 6543
- [ ] `DIRECT_URL` - Supabase Session URL, port 5432
- [ ] Both URLs have same project-ref and password
- [ ] `ADMIN_SESSION_SECRET` - at least 16 characters
- [ ] `ADMIN_PASSWORD` - set for admin dashboard access
- [ ] `ADMIN_AUTH_REQUIRED` - set to `true` for production
- [ ] `NEXTAUTH_URL` - set to production domain
- [ ] `GEMINI_API_KEY` - set if screenshot OCR is needed
- [ ] Discord env vars - set if Discord OAuth is required

---

## Migration workflow (current -- replaces db push)

FRH now uses **Prisma Migrate** as the source of truth. The `prisma/migrations/` folder is committed to the repo. Schema changes must be made via `prisma migrate dev` locally, and the resulting migration files committed and pushed.

**Never use `prisma db push` for deployments.** It bypasses the migration history, leaves the `_prisma_migrations` table out of sync, and causes `prisma migrate deploy` to fail or produce a drift error on the next run.

See `docs/PRISMA_WORKFLOW.md` for the complete workflow policy and guidance on when `db push` is acceptable locally.

### Fresh database setup

```bash
# 1. Apply all migrations and seed mock data
npm run db:reset
# equivalent to: prisma migrate reset --force && node prisma/seed.mjs
```

### Adding a schema change

```bash
# Edit prisma/schema.prisma, then:
npm run db:migrate:dev -- --name describe-your-change
# Creates prisma/migrations/<timestamp>_describe-your-change/migration.sql
# Commit the new migration file alongside your code changes.
```

### Deploying to production (Vercel / CI)

Vercel does not run migrations automatically. Migrations must be applied before or alongside each deploy:

**Option A — GitHub Actions (automated, recommended):**
The `ci.yml` `migrate` job runs `npx prisma migrate deploy` on every push to `main`, after the build job passes. Requires `DATABASE_URL` and `DIRECT_URL` set as GitHub Actions secrets.

**Option B — manual pre-deploy:**
```bash
# Run from a terminal with production env vars set
npx prisma migrate deploy
```

---

## S9 initial deployment (env vars + first migration)

### Required Vercel environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Supabase pooled connection string — Supavisor **Transaction** mode, port 6543 (used by Prisma at runtime) |
| `DIRECT_URL` | Supabase direct connection string — Supavisor **Session** mode, port 5432 (required for Prisma migrations) |
| `ADMIN_SESSION_SECRET` | HMAC secret for admin session cookies. Min 16 chars; generate with `openssl rand -base64 48`. Required in production. |
| `ADMIN_AUTH_REQUIRED` | Set to `true` in production to enforce admin session cookies on all mutating endpoints. |
| `GEMINI_API_KEY` | Google Gemini API key — used by `lib/gemini.js` for screenshot OCR via `/api/ocr/extract`. Required for captain screenshot uploads to work. |

### Captain key URL pattern

Captains authenticate to match pages via a URL query param:

```
/matches/[matchId]?key=<captainKey>
```

`homeTeamCaptainKey` and `awayTeamCaptainKey` are stored on each `Match` row. Admins share these URLs with team captains. The key unlocks the captain upload section for screenshot submission.

---

## 1. Apply the schema change for chat-only SSE frames

**Why:** Issue #8 added `Draft.chatsVersion` so chat traffic no longer triggers a full SSE state push.

This column is included in the `20250526000000_init` migration. No separate step required — it was applied as part of the initial `prisma migrate reset`.

**Verify:**

```bash
psql "$DIRECT_URL" -c '\d "Draft"' | grep chatsVersion
# expected: chatsVersion | integer | not null | default 0
```

---

## 2. Migrate any rows with `status = 'active'`

**Why:** Issue #11 retired the legacy `'active'` status. The runtime code in `main` no longer treats `'active'` as in-picking-phase, so any existing row in that state would reject pick submissions until migrated.

**Run:**

```bash
# Dry-run — prints the count and the per-row target status.
node scripts/migrate-active-status.mjs

# Apply.
node scripts/migrate-active-status.mjs --apply
```

The script is idempotent. Maps each `'active'` row to:
- `'picking'` if any pick has a `godId` (game in progress)
- `'pending'` otherwise

**Verify:**

```bash
psql "$DIRECT_URL" -c "SELECT COUNT(*) FROM \"Draft\" WHERE status='active';"
# expected: 0
```

---

## 3. Roll out admin auth (issue #6)

**Why:** PR #20 added an HMAC-signed session cookie + `requireAdmin` guard on every admin-mutating endpoint, gated behind `ADMIN_AUTH_REQUIRED`. The flag is `false` by default so the cookie path can be deployed and verified before being switched on.

**Step 3a — set the secret in prod env:**

```bash
openssl rand -base64 48
```

Set as `ADMIN_SESSION_SECRET`. The app refuses to start in `NODE_ENV=production` if this is missing or shorter than 16 chars.

**Step 3b — deploy with the flag still off:**

`ADMIN_AUTH_REQUIRED=false` (default). All endpoints behave exactly like before. Log in at `/admin`, confirm the dashboard works, confirm a cookie was set:

```bash
curl -i -c /tmp/cookies.txt -d '{"password":"YOUR_ADMIN_PASSWORD"}' \
  -H 'Content-Type: application/json' \
  https://YOUR_HOST/api/admin-auth
# expected: 200 + Set-Cookie: frh_admin_session=...; HttpOnly; SameSite=Lax; ...

curl -i -b /tmp/cookies.txt https://YOUR_HOST/api/admin-auth
# expected: 200 with { ok: true }
```

**Step 3c — flip the flag:**

Set `ADMIN_AUTH_REQUIRED=true` and redeploy. From this point:
- Every admin-mutating endpoint returns 401 without a valid cookie.
- The admin dashboard auto-detects expired sessions on mount and re-prompts for the password.

**Rollback:** set `ADMIN_AUTH_REQUIRED=false` (or unset it) and redeploy. No data migration required.

---

## 4. Optional: warm caches

The reference-data cache in `lib/referenceData.js` (issue #8) hydrates lazily on first read and refreshes on every admin mutation. No action needed — but if you want a clean post-deploy state, just hit `/api/health` and any draft page once.

---

# Polish bucket (#16) — remaining work

Still open. Suggested order:

1. **GitHub Actions CI** — catches regressions on every PR. `npm ci`, `next lint`, `prisma generate`, and `prisma migrate deploy` on merge to main. ✅ Done in `ci.yml`.
2. **Vitest integration coverage** — especially the concurrency invariants from issue #7 and the vault behavior from #15.
3. **Structured logging** — small `lib/log.js` with `log(event, meta)`. Use it on SSE connect/disconnect, admin mutations, and the rate-limit 429s.
4. **Image caching** — `scripts/sync-god-art.mjs` to download god icons + wide art into `public/gods/<slug>/`, fall back to smitefire on miss, optional `God.imageSlug` for admin overrides.
5. **CSP** — start in `Content-Security-Policy-Report-Only` mode, fix what breaks, then enforce.
6. **Stricter ESLint** — at minimum `eqeqeq`, `no-console: ['warn', { allow: ['warn', 'error'] }]`, `prefer-const`.
