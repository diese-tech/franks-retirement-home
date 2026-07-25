# Production Readiness & Usability — Implementation Plan

Built from `docs/production-readiness-audit-2.md`. Six fleet-able workstreams, each scoped to a disjoint file set so they can run as parallel agent tasks against `main`. Kept deliberately small and targeted per-workstream — this is a hardening/consolidation pass, not a redesign.

## Workstream 1 — Error handling + server-side Sentry (backend)

**Files:** new `lib/apiError.js`; `app/api/captain/matches/route.js`; `app/api/exports/pending-ocr/route.js`; `app/api/forgelens/callback/route.js`; `app/api/stats/import/route.js`

- `lib/apiError.js`: a small `reportServerError(err, context)` helper — calls `Sentry.captureException(err, { extra: context })` guarded the same way the existing error boundaries gate on `NODE_ENV === 'production' && !!process.env.SENTRY_DSN`, plus `console.error`. Reused across the routes below rather than duplicating the guard.
- Wrap `app/api/captain/matches/route.js`'s `prisma.match.findMany` and `app/api/exports/pending-ocr/route.js`'s `prisma.extractedStatLine.findMany` in try/catch, returning a clean 500 JSON error via the new helper — mirror the response shape every other route in this codebase already uses.
- Wrap `app/api/forgelens/callback/route.js`'s handler body (the `$transaction` and the `autoResolveExtractedRows` helper) in try/catch using the same helper. Do not touch the existing HMAC verification (`X-ForgeLens-Signature`, constant-time compare, fail-closed on unset secret) — that's already correct.
- Add a `MAX_ROWS = 500` cap to `app/api/stats/import/route.js`, matching `players/import`'s existing cap exactly (same error message shape).

This is intentionally scoped to the 3 routes with zero error handling today, not a rewrite of all ~80 API routes — broader systematic Sentry instrumentation across every route is real future work, flagged below, not done in this pass.

## Workstream 2 — Rate-limit expansion (backend)

**Files:** `app/api/drafts/[id]/pick/route.js`, `app/api/drafts/[id]/ban/route.js`, `app/api/drafts/[id]/ready/route.js`, `app/api/drafts/[id]/swap/route.js`, `app/api/player-drafts/[id]/pick/route.js`, `app/api/superlatives/suggest/route.js`

Apply the existing `lib/rateLimit.js` (`checkRateLimit`, already Upstash-backed with in-memory fallback — same import/usage pattern as `app/api/bulletin/submit/route.js` or `app/api/admin-auth/route.js`) to these six routes. These are the highest-risk gaps: reachable by a captain-key or any logged-in Discord user, not gated by full admin auth, and currently unthrottled. Pick sane limits matching this codebase's existing conventions for similarly-sensitive actions (check `admin-auth`'s and `bulletin/submit`'s configured windows/limits as a reference point rather than inventing new numbers).

## Workstream 3 — Enable RLS on the 38 legacy tables (database)

**Files:** new Prisma migration; `docs/adr/0005-rls-already-enabled-known-gaps.md` (follow-up correction)

Same pattern already used for `Tournament`/`Participant`/`BracketMatch` in `prisma/migrations/20260724230000_tournament_bracket/migration.sql`: `ALTER TABLE "<name>" ENABLE ROW LEVEL SECURITY;` with **no policies**, for every one of the 38 pre-existing `public` tables currently flagged by Supabase's advisor lint. This is safe specifically because Prisma's `postgres` role has `rolbypassrls = true` (confirmed directly against the real project in ADR-0005's correction) — enabling RLS with no policies only closes the direct-PostgREST-API surface and has zero effect on the app's own behavior.

- Enumerate the actual 38 table names (query Supabase's advisors/information_schema for the live list — don't hand-copy from the ADR text, confirm against the real project `vxfakbgrmiqrstigjlug` directly).
- Write the migration, verify via `prisma migrate diff --from-empty --to-schema-datamodel` the same way Phase 0's tournament migration was verified (no live DB in the sandbox to run interactively).
- Update ADR-0005 with a final correction: RLS is now enabled (no policies) on all tables in `public`, closing the gap the ADR has tracked since its last correction.

This workstream touches the database directly — flag for extra care in review (the CI `migrate` job only runs on push to `main`, so nothing applies until this PR merges, same safety property every other schema PR in this repo has had).

## Workstream 4 — CI: run e2e in a non-blocking job

**Files:** `.github/workflows/ci.yml`

Add a `playwright` job alongside the existing `build`/`migrate` jobs. Given the 5 existing specs need a running app + database (`playwright.config.js`'s `webServer` config), and this repo's CI doesn't currently provision a database for anything but the gated `migrate` job against production, use engineering judgment on the right shape:
- If a lightweight ephemeral Postgres (e.g. a `services:` block in the workflow) can back a `prisma migrate deploy` + seed + `next build`/`next start` cleanly within CI, wire the full e2e run.
- If that's not feasible within this pass's scope, add the job as `workflow_dispatch`-triggered (manual) rather than skipping it entirely, and say so explicitly in the PR — don't silently leave e2e untested in CI without at least a documented, callable path to run it.

Either way, this job should not block `build`/`migrate` — it's additive coverage, not a new merge gate, since flaky e2e infra shouldn't be able to block a merge on day one.

## Workstream 5 — Admin discoverability (frontend)

**Files:** `app/admin/AdminClient.js`

- Remove the dead `HomepageEditorPanel` function and its now-orphaned imports/helpers — the real, live homepage editor is `EditorToolbar` in `app/HomepageWrapper.js`. Confirm nothing else references `HomepageEditorPanel` before deleting.
- Add a small "Content Pages" section to the dashboard (a `RetroWindow` block or a new lightweight tab — match whichever fits this file's existing layout best) linking out to `/bulletin-board`, `/fraud-watch`, and `/knows-ball`, each with a one-line note that editing happens via the "Edit" toggle on that live page itself. This directly fixes the "admin has no way to discover how to edit these" gap without restructuring how those three features actually work.
- Add a link to `/admin/match-report` from the dashboard (a card or button, similar treatment to how Tournaments got a link-out card before its own tab existed) — it's a complete, working OCR review tool with zero discoverability today.

## Workstream 6 — Captain/player auth signal + captain page gate (backend + frontend)

**Files:** `app/api/auth/discord/me/route.js`, `app/captain/page.js` (or its client component), `components/Nav.js` (only if it needs to consume the new fields — check first)

- Extend `/api/auth/discord/me`'s response to include `isCaptain`/`isPlayer` booleans, computed server-side via the existing `hasDiscordCaptainRole`/`hasDiscordPlayerRole` helpers in `lib/discordAuth.js` (already used elsewhere — reuse, don't reimplement).
- Add a clear gate to `/captain`: a non-captain landing there directly should see an explicit "you're not currently a team captain" message rather than a confusingly empty dashboard. Use the new `isCaptain` signal; match this app's existing empty/error-state visual conventions (check `PasswordGate` or similar for tone).

## Explicitly flagged, not touched this pass

- **Captain self-service PlayerDraft picks.** The single biggest captain-facing usability gap (captains can't pick for themselves; an admin has to do it). Not a hardening-sized change — it touches pick-order/timer logic that currently assumes an admin driver, plus new auth wiring and UI. Simpler alternative worth considering first: let a captain *view* live pick order/timer state without an admin present (read-only self-service), as a smaller intermediate step before full self-pick.
- **Broad Sentry instrumentation across all ~80 API routes.** Workstream 1 fixes the 3 routes with zero error handling; systematically wiring `reportServerError` into every remaining route's existing catch blocks is real, valuable follow-up work, just too large to bundle into this pass.
- **`nextGame` disconnected from match-bound drafts** (`docs/season-9-ops-reference.md`'s own description: low-impact UI confusion, not a functional break). Worth a look in a future pass; not prioritized here.
- **The two-mental-model admin split isn't being unified**, only made discoverable (Workstream 5). Actually moving Bulletin/Fraud Watch/Betting-Line editing into `/admin` proper (instead of linking out to the edit-in-place pages) is a bigger architectural call the product owner should make deliberately, not something to default into as a side effect of a hardening pass.

## Suggested execution

All six workstreams are independent of each other (disjoint files, no shared contracts to agree on up front the way Phase 1's B–F workstreams needed) — dispatch all six in parallel. Merge order doesn't matter for conflicts; recommend landing Workstream 3 (RLS) with extra scrutiny given it's the only one touching the database directly.
