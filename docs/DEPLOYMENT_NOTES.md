# Deployment Notes

Operational steps required when shipping recent changes. Append new sections at the top as more deployment-relevant work lands.

If you're deploying from `main` for the first time after the audit work (issues #4–#16), do **all four** steps below.

---

## 1. Apply the schema change for chat-only SSE frames

**Why:** Issue #8 added `Draft.chatsVersion` so chat traffic no longer triggers a full SSE state push.

**Run:**

```bash
npx prisma generate
npx prisma db push
```

Default `0` is backfilled by Prisma. Existing rows are unaffected. Pre-existing chat history continues to render — only the *next* chat's broadcast shape changes.

**Verify:**

```bash
psql "$DIRECT_URL" -c '\d "Draft"' | grep chatsVersion
# expected: chatsVersion | integer | not null | default 0
```

**Rollback:** the column is purely additive. To revert, deploy older code; the new column stays harmless.

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

**Order:** can be run before or after deploy. If you run after, captains may see "Draft is not in picking phase" 400s for the migration window — small enough that running before is preferred.

---

## 3. Roll out admin auth (issue #6)

**Why:** PR #20 added an HMAC-signed session cookie + `requireAdmin` guard on every admin-mutating endpoint, gated behind `ADMIN_AUTH_REQUIRED`. The flag is `false` by default so the cookie path can be deployed and verified before being switched on.

**Step 3a — set the secret in prod env:**

```bash
# Generate a 48-byte random secret. Anything ≥ 16 chars works in non-prod.
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

Set `ADMIN_AUTH_REQUIRED=true` and redeploy (or restart, depending on host). From this point:
- Every admin-mutating endpoint returns 401 without a valid cookie.
- The admin dashboard auto-detects expired sessions on mount and re-prompts for the password.

**Rollback:** set `ADMIN_AUTH_REQUIRED=false` (or unset it) and redeploy. The cookie path keeps working but is no longer enforced. No data migration required either way.

---

## 4. Optional: warm caches

The reference-data cache in `lib/referenceData.js` (issue #8) hydrates lazily on first read and refreshes on every admin mutation. No action needed — but if you want a clean post-deploy state, just hit `/api/health` and any draft page once.

---

# Polish bucket (#16) — remaining work

Still open. Suggested order:

1. **GitHub Actions CI** — catches regressions on every PR. `npm ci`, `next lint`, `prisma format -- --check`, and (after item 2) `npm test`.
2. **Vitest integration coverage** — especially the concurrency invariants from issue #7 and the vault behavior from #15. Easiest harness is an ephemeral SQLite via Prisma, but the existing schema's `Json` and PostgreSQL specifics make `pg-mem` or a real test database the more honest choice.
3. **Structured logging** — small `lib/log.js` with `log(event, meta)`. Use it on SSE connect/disconnect, admin mutations, and the rate-limit 429s.
4. **Image caching** — `scripts/sync-god-art.mjs` to download god icons + wide art into `public/gods/<slug>/`, fall back to smitefire on miss, optional `God.imageSlug` for admin overrides.
5. **CSP** — start in `Content-Security-Policy-Report-Only` mode, fix what breaks, then enforce.
6. **Stricter ESLint** — at minimum `eqeqeq`, `no-console: ['warn', { allow: ['warn', 'error'] }]`, `prefer-const`.

Each of these is independent and rollback-safe. Pick whatever the next deploy window comfortably tolerates.
