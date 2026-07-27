# E2E (Playwright) CI Failure Investigation — Handoff

**Date:** 2026-07-26
**Status:** All findings below were independently confirmed fixed by PR #167
("Add 320px mobile coverage, fix real overflow bugs, commit visual
baselines") after this investigation was written but before it was
committed. This doc is kept as a record of root causes, not a to-do list —
see [Outcome](#outcome) at the bottom for what's actually still open.

## Why this exists

PR #153 (Workstream 4) added a `playwright` job to CI for the first time —
5 e2e specs under `tests/e2e/**` had never run in CI before. The first real
run, on PR #165, came back with 27 failures. That job is deliberately
`continue-on-error: true` (non-blocking by design, see `.github/workflows/ci.yml`),
so it didn't block the PR, but 27 failures on a brand-new job needed
triage: which are real app bugs, which are test bugs, and which are just
"first run, no baseline yet" noise.

## Method

Reproduced locally rather than reading logs blind: started a local
Postgres 16 cluster, ran `prisma migrate deploy` + `npm run db:seed`
against it, built and started the app with the same env vars CI uses
(`ADMIN_SESSION_SECRET`, `DISCORD_SESSION_SECRET`, `DISCORD_ADMIN_ROLE_ID`,
etc.), then ran the failing specs directly. Confirmed each root cause by
reading the actual DOM/HTTP response, not just the assertion diff.

Caveat hit along the way: this sandbox only has a substitute Chromium
build (`/opt/pw-browsers/chromium`, not the exact pinned version CI's
`npx playwright install --with-deps chromium` resolves), so one cluster of
failures (see below) didn't reproduce cleanly locally.

## Findings

### 1. `/teams` and `/players` redirects — real app bug, confirmed

`app/teams/page.js` / `app/players/page.js` call `redirect('/roster')`
from a Server Component. Because these pages have no dynamic data
dependency, Next.js statically prerenders them — and `redirect()` from a
**static** page can't emit a real HTTP 3xx (there's no request to attach a
status code to at build time). It falls back to a client-side
`<meta http-equiv="refresh" content="1;url=/roster">`, which real browsers
honor after a ~1s delay but `curl` and Playwright's `page.goto()` do not
follow automatically.

Confirmed directly: `curl -I http://localhost:3000/teams` returned `200`
with `x-nextjs-cache: HIT`, not a redirect — the meta-refresh tag was
sitting in the HTML body instead.

### 2. Mobile hamburger locator — test bug, confirmed

`tests/e2e/mobile.spec.js`'s hamburger test used:
```js
page.locator('button[aria-label="Open menu"], button[aria-label="Menu"], nav button').first()
```
A comma-separated CSS selector is a DOM-order union, not a fallback list.
`components/Nav.js`'s hamburger is `aria-label="Toggle menu"` — not
`"Open menu"` or `"Menu"` — so neither of the first two branches ever
matched, and `.first()` fell through to the generic `nav button` branch,
which resolves to the **theme-toggle button** (DOM-order-first inside
`<nav>`, rendered before the hamburger). That button is `display: none` on
mobile via `app/globals.css`'s breakpoint, so `toBeVisible()` failed
against the wrong element — the real hamburger was visible and fine the
whole time.

### 3. `nav.spec.js` "public nav links are present on homepage" — test bug, confirmed

This test checks desktop nav links (`.frh-menubar__items`), which are
deliberately `display: none` below 768px in favor of the hamburger +
drawer (`app/globals.css`). It only failed on the `mobile-chrome` project
because that project's default viewport is under the breakpoint — the
CSS was doing exactly what it's supposed to.

### 4. `tournament.spec.js` strict-mode violation on "Team Alpha" — test bug, confirmed

The "Final" bracket column was located via:
```js
viewerPage.locator('div...shrink-0', { hasText: 'Final' })
```
`hasText` does a case-insensitive **substring** match, and `"Semifinals"`
literally contains `"final"` as a substring. In a 4-team bracket
(Semifinals + Final), this locator matched both round columns once each
had a winner to show, tripping Playwright's strict-mode duplicate guard.

### 5. 12 "snapshot doesn't exist" failures — not a bug, expected

This job's first-ever CI run had no `tests/e2e/mobile.spec.js-snapshots/*.png`
baselines committed. Needed a one-time `--update-snapshots` run with the
result committed.

### 6. `homepageEditor.spec.js` mobile-chrome click timeouts — inconclusive locally

3 tests (`admin can enter editor mode`, `save button calls API`, `preview
button opens draft`) hung 30s clicking `[data-testid="homepage-edit-toggle"]`
on `mobile-chrome` only. Local repro was unreliable (see Chromium-version
caveat above) and didn't match CI's exact failure pattern, so this was
left flagged rather than diagnosed with confidence.

## Outcome

Every item above (real bug and test bugs alike) was independently found
and fixed by **PR #167** (`a78b0be`, merged to `main`), including:
- `next.config.js` `redirects()` for `/teams` and `/players` (a cleaner
  fix than patching the tests — routing-layer redirects always emit a
  real 307, sidestepping the static-page limitation entirely).
- The hamburger locator fix (`aria-label="Toggle menu"` listed first).
- `nav.spec.js` pinned to a desktop viewport for the nav-links check.
- The bracket locator anchored to `/^Final/` (not just `'Final'`) to stop
  matching "Semifinals".
- Visual snapshot baselines generated and committed for both projects.
- Item 6 (`homepageEditor.spec.js` mobile clicks) turned out to be the
  same class of bug as item 3: the Preview button is
  `hidden sm:inline-flex` by design, so that one test also needed pinning
  to a desktop viewport. PR #167's own verification: **142/142 e2e tests
  passing, 0 failed, 0 skipped.**

**Nothing from this investigation needs further action on the e2e side.**

## What's actually left: PR #165 has a merge conflict

While this investigation was running, five *other* concurrent PRs landed
on `main` (#159–167) that also added test coverage across much of the API
surface (`API test coverage + Sentry` groups A–F, #160–166) — overlapping
with the same routes PR #165
("Hardiness audit follow-up: test coverage for the six merged readiness
workstreams") targeted. PR #165 is now `mergeable_state: dirty` and needs
conflict resolution against current `main` before it can land — likely by
diffing what #165 adds against what groups A–F already cover and dropping
whatever's now redundant, keeping anything genuinely unique.
