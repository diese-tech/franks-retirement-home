# Deployment Notes

Operational steps required when shipping recent changes. Append new sections at the top as more deployment-relevant work lands.

---

## Migration workflow (current — replaces db push)

FRH now uses **Prisma Migrate** as the source of truth. The `prisma/migrations/` folder is committed to the repo. Schema changes must be made via `prisma migrate dev` locally, and the resulting migration files committed and pushed.

**Never use `prisma db push` for deployments.** It bypasses the migration history, leaves the `_prisma_migrations` table out of sync, and causes `prisma migrate deploy` to fail or produce a drift error on the next run.

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
| `DATABASE_URL` | Pooled Neon connection string (used by Prisma at runtime) |
| `DIRECT_URL` | Non-pooled Neon connection string (required for migrations — remove `-pooler` from hostname) |
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
