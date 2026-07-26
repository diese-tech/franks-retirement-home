# Production Readiness & Usability Audit (2026-07-25)

A follow-up to PR #137's launch-readiness audit (2026-07-08) and `LAUNCH_CHECKLIST.md`. That pass focused on launch-blocking bugs; this one asks a different question: with the app live and the Tournament feature just shipped, how close is FRH to a genuinely production-hardened, easy-to-operate platform for admins, captains, and players? Conducted via three parallel research passes — documentation staleness, the real `app/` route/feature surface, and technical health (error handling, tests, security, CI, monitoring) — each cross-checked against actual code rather than trusting existing docs.

## Scorecard

| Area | Score | Why |
|---|---|---|
| **Production readiness** | **6/10** | Solid bones (CI correctly gates migrations to main-push only, Sentry is genuinely wired for client-side errors, a real `/api/health` endpoint exists, zero abandoned TODO/stub code in `app/`/`lib/`, rate limiting exists and works where it's applied) undercut by a real, long-documented security gap (RLS disabled on 39 pre-existing tables) and inconsistent defense-in-depth (rate limiting covers 9 of ~80 route files; a few routes have zero error handling and would 500 uncleanly; API-layer errors never reach Sentry, only client-side ones do; e2e tests never run in CI). |
| **Admin usability** | **6/10** | The core admin dashboard (`/admin`) is coherent for the features it covers, but the app has grown a second, undocumented admin mental model: Bulletin Board, Fraud Watch, and Knows Ball are edited inline on their own *public* pages via an "Edit" toggle, invisible from `/admin` itself. A whole OCR/stat-report admin tool (`/admin/match-report`) has no link anywhere in the app. Dead code (`HomepageEditorPanel`) sits in `AdminClient.js` for a feature that's actually implemented elsewhere. |
| **Captain/player usability** | **6.5/10** | Match reporting, drafts, tournaments, and — corrected below — `PlayerDraft` pick submission itself all support captain self-service. The client still has no clean "am I a captain" signal (`/api/auth/discord/me` only exposes `isAdmin`/`teamId`), `/captain` has no gate of its own — a non-captain hitting it directly just sees a confusing empty dashboard rather than a clear message — and `PlayerDraft`'s *lifecycle* operations (create, set order, complete) remain admin-only, which is a smaller gap than originally stated here. |

**Target for this pass: 8/10 on all three**, via the plan in `docs/production-readiness-implementation-plan.md`.

## Findings

### Production readiness

1. **RLS is disabled on 39 pre-existing `public` tables** (42 total models in `prisma/schema.prisma`, minus the 3 tournament tables that already have it — confirmed directly, not copied from the ADR text, which had scoped "38" to an earlier commit — the only RLS-enabling migration is the tournament feature's, which covers just its own 3 new tables). This is real: Supabase's PostgREST Data API is reachable independently of the app's own Prisma-layer checks. Low-risk to fix — Prisma's `postgres` role already has `BYPASSRLS`, so enabling RLS with no policies (the same pattern already applied to the 3 tournament tables) closes the gap with zero effect on app behavior. Documented in `docs/adr/0005`, unresolved since.
2. **Rate limiting is narrow.** `lib/rateLimit.js` is a real, working token-bucket/sliding-window limiter (Upstash-backed, in-memory fallback), but only 9 of roughly 80 route files use it. The highest-risk gaps are the routes reachable by a non-admin over an open or guessable channel: `drafts/[id]/pick|ban|swap|ready` (captain-key or Discord role, not full admin), `player-drafts/[id]/pick`, and `superlatives/suggest` (any logged-in Discord user). Admin-gated routes (teams/players/matches/etc.) are lower priority since `resolveAdminAuth` already restricts them.
3. **A few routes have no error handling at all**: `app/api/captain/matches/route.js`, `app/api/exports/pending-ocr/route.js`, and — most notably — `app/api/forgelens/callback/route.js` (an externally-triggered webhook, HMAC-verified correctly, but its `$transaction` and helper function have zero try/catch). A transient DB error there 500s as an unhandled exception instead of a controlled response.
4. **`stats/import` has no row cap**, unlike `players/import` (capped at 500). Same shape of route, inconsistent guard.
5. **Sentry is genuinely wired, but only client-side.** `withSentryConfig`, three runtime config files, and `Sentry.captureException` calls in every React error boundary are real and correct. But no `app/api/**` route ever calls `Sentry.captureException` — server errors rely on inconsistent `console.error` calls, so the exact routes most likely to fail silently (item 3 above) are also invisible to monitoring.
6. **CI never runs the 5 Playwright e2e specs.** `.github/workflows/ci.yml` runs Vitest (`tests/unit` + `tests/api`) and gates `prisma migrate deploy` correctly to main-push-only — both good — but e2e is dev-only/manual today.
7. **Test coverage is uneven.** Draft, tournament, betting, and reschedule flows are well covered. The general reference-data CRUD surface (teams, players, orgs, seasons, divisions, gods) and several admin tools (change-requests, editorial-cases, exports, stats/import, admin-auth) have little to no API-level test coverage.

### Admin usability

1. **Two incompatible admin-editing mental models.** Players/Teams/Matches/Gods/Drafts/Player-Drafts/Submissions/Change-Requests are all managed centrally from tabs in `/admin`. Bulletin posts, Fraud Watch cases, and Knows Ball betting lines are **not** — despite having full `/api/admin/**` CRUD routes, they're edited inline on their own public pages via a modal, toggled by an admin-only "Edit" button the admin has to already know is there. An admin exploring `/admin` has no way to discover this.
2. **`/admin/match-report`** — a complete OCR/stat-extraction review tool — has zero inbound links from anywhere in the app (no `/admin` tab, no nav entry). It only exists if someone already knows the URL.
3. **Dead code**: `HomepageEditorPanel` in `app/admin/AdminClient.js` is fully built but never rendered — the tabs array has no entry for it. The real, live homepage editor is a completely separate implementation (`EditorToolbar` in `app/HomepageWrapper.js`). Two front-ends for the same feature, one of them inert.
4. **Minor**: `/api/ocr/extract` still imports the legacy `requireAdmin` directly instead of `resolveAdminAuth` (functionally fine, but a second "is this an admin" pattern living alongside the now-standard one).

### Captain/player usability

1. **Correction: `PlayerDraft` pick submission already supports captain self-service.** `POST /api/player-drafts/[id]/pick` accepts either an admin session or a Discord-authenticated captain, resolves the caller's own `TeamMember` record, and restricts the pick to that captain's own team — this was already built, not a gap. `docs/season-9-ops-reference.md` and an earlier version of this audit both claimed otherwise; both are now corrected. What *is* still admin-only: creating a `PlayerDraft`, setting its pick order, and completing it (`app/api/player-drafts/route.js`, `[id]/route.js`, `[id]/order/route.js`, `[id]/complete/route.js` all gate on `resolveAdminAuth` with no captain fallback) — a smaller, lifecycle-management gap, not a per-pick one.
2. **No clean client-side "what am I" signal.** `/api/auth/discord/me` returns `{ isAdmin, teamId, divisionId }`. The server has `hasDiscordCaptainRole`/`hasDiscordPlayerRole` helpers, but nothing surfaces a captain/player distinction to the client — UI has to infer it indirectly (e.g. Nav shows "Captain" only when `teamId` is truthy, which conflates "on a team" with "is that team's captain").
3. **`/captain` has no gate of its own.** The link is hidden from Nav for non-captains, but the page itself doesn't redirect or message a non-captain who navigates there directly — they just see an empty dashboard, which reads as broken rather than "you're not a captain."

## Documentation issues found (see cleanup in this same pass)

- **Real architecture contradiction**: `docs/forgelens-worker-architecture.md` and `docs/review-queue-policy.md` both claim the ForgeLens worker path is deprecated/historical-only — but `app/api/forgelens/callback/route.js` and `app/api/forgelens/jobs/route.js` are live, and `LAUNCH_CHECKLIST.md` instructs admins to configure `FORGELENS_URL`/`FORGELENS_API_KEY`/`FORGELENS_HMAC_SECRET` for production. Both the direct-Gemini and ForgeLens-callback OCR paths are live today.
- **`docs/frh-db-foundation.md`** claims Bulletin/Wallet/Betting/comments/reactions are "intentionally not implemented" — all shipped since. Its "recommended next implementation order" is obsolete.
- **God count mismatch**: `SETUP.md`/`RECOVERY.md` say 83, `docs/season-9-ops-reference.md` says 81. Verified directly against `prisma/seed.mjs`: **83 is correct.**
- **`docs/season-9-ops-reference.md`** says "172 tests" — actual count is **456 tests across 29 files**.
- **`README.md`/`docs/ARCHITECTURE.md`** feature lists predate Tournaments, Bulletin Board, Fraud Watch, Knows Ball/Wallet, and Player Draft — all shipped, none mentioned.
- **`docs/season-9-backlog.md`** — most "must ship" and several "can wait" items have since shipped (audit logging, public Players page, CSV import/export, full ForgeLens integration); only genuinely open items are watch/stream awareness (#15, not built) and captain-side review boundaries (#11, unclear).
- **`docs/season-9-migration-runbook.md`**'s "additive changes" tracking log has been abandoned since Tournament/Bulletin/Wallet migrations landed — never updated despite the doc's own stated process.
- **`docs/tournament-bracket-implementation-plan.md`** is fully executed — historical now, not active planning.
- **`docs/adr/0005`** needs a short follow-up confirming the tournament tables' RLS landed (it did) and that the other 39 tables' gap is still open (it is, until this pass's plan closes it).

## What's already solid (no action needed)

- CI's migration gating (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `needs: build`) is correct.
- Zero admin-auth gaps found — every `/api/admin/**` route enforces `resolveAdminAuth`.
- Zero abandoned `TODO`/`FIXME`/stub markers in actual application code.
- `app/api/health` is a real, side-effect-free Postgres check suitable for uptime monitors.
- Sentry, rate limiting, and audit logging are all real, working systems — just narrower in scope than they should be.
