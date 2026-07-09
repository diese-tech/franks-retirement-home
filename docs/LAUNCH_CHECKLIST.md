# Launch-Day Checklist

Operational steps and known caveats for bringing FRH live for a season.
Run top to bottom; every step is idempotent unless noted.

## 1. Infrastructure

- [ ] **Supabase project is ACTIVE.** Free-tier projects auto-pause after
  inactivity — a paused project fails every DB call and blocks CI's
  `prisma migrate deploy`. Check the Supabase dashboard and restore if
  needed.
- [ ] Vercel env vars synced (see `docs/DEPLOYMENT_NOTES.md`), then:
  `npm run verify:env` locally with production values. It must pass with
  0 failures — Discord OAuth vars are required, not optional.
- [ ] `npx prisma migrate status` against prod is clean (no drift, no
  pending migrations besides the ones you're about to deploy).
- [ ] **Before deploying `20260707140000_league_ops_hardening`**: check
  for duplicate fixtures — the migration adds a unique constraint and
  fails if any exist:
  ```sql
  SELECT "seasonId","week","homeTeamId","awayTeamId",count(*)
  FROM "Match" GROUP BY 1,2,3,4 HAVING count(*) > 1;
  ```
- [ ] `node scripts/verify-db.mjs` passes after deploy (connectivity +
  row counts).
- [ ] Upstash Redis configured (`UPSTASH_REDIS_REST_URL`/`_TOKEN`).
  Without it, rate limiting is per-serverless-instance only, which
  weakens login brute-force protection.
- [ ] If using the ForgeLens OCR worker: `FORGELENS_URL`,
  `FORGELENS_API_KEY`, and `FORGELENS_HMAC_SECRET` are all set. The
  callback endpoint rejects everything (503) when the secret is unset.

## 2. Season activation

- [ ] Seed data present (`npm run db:seed` is idempotent).
- [ ] Flip the season to active via the API (admin session required):
  ```
  PATCH /api/seasons/<seasonId>   body: { "status": "active" }
  ```
  Activating a season automatically demotes any other active season to
  completed. The homepage/captain views key off the active season.
- [ ] `DISCORD_TEAM_ROLE_MAP_JSON` team IDs match the seeded Team IDs
  (`verify:env` checks it parses; spot-check one captain can log in and
  sees their team on `/captain`).

## 3. Known operational caveats

- **Discord roles are frozen in the session cookie for 24 h**
  (`lib/discordAuth.js`). A captain removed or reassigned in Discord
  keeps their old access until they re-login or the cookie expires.
  During launch-week roster churn, ask affected users to log out/in.
- **Standings cache is per-process** (`lib/standings.js`, 30 s TTL).
  After approving a result, other serverless instances can serve
  standings up to 30 s stale. This is expected; don't chase it.
- **OCR uploads are rate-limited** (6 per 10 min per captain client) and
  each upload is a paid Gemini call. Failed extractions land in the
  review queue as `failed` and are handled manually.
- **Betting lines are terminal once settled or void.** Settling requires
  `winningTeamId` and pays out/refunds in the same transaction; a
  settled line can never be reopened (prevents double payouts).

## 4. Smoke test (5 minutes, production)

1. Anonymous browser: `/`, `/standings`, `/schedule`, `/roster` render;
   `/admin` shows only the password gate (no data flash, no admin data
   in view-source).
2. Log in at `/admin` with the admin password — dashboard loads.
3. Discord captain login → `/captain` shows the right team.
4. Create a throwaway match in a test week, report + confirm a result,
   check standings update, then delete the match.
5. `curl -X POST https://<host>/api/forgelens/callback -d '{}'` returns
   401/503 (never 200).
