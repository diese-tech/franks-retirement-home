# FRH Season 9 League Ops — Canonical Backlog

> Source of truth for the Season 9 League Ops sprint. 32 ordered issues across 9 chunks. Pair this file with `scripts/create-season-9-issues.sh` to bulk-create every issue in GitHub with the correct labels and dependency notes.

## GitHub issue mapping

The 32 backlog items were created on GitHub as issues **#34 through #65** (in order). Inside this document and inside the GitHub issue bodies, references to other backlog items use the **GitHub issue number**, not the ordinal position.

| Ordinal | GitHub | Title |
|--:|--:|---|
| 1  | [#34](https://github.com/diese-tech/franks-retirement-home/issues/34) | [UX] Fix page-scroll snap on draft lock-in |
| 2  | [#35](https://github.com/diese-tech/franks-retirement-home/issues/35) | [UX] Fix blurry ban-phase god images |
| 3  | [#36](https://github.com/diese-tech/franks-retirement-home/issues/36) | [UX] Collapsible/docked chat panel — LoL-style |
| 4  | [#37](https://github.com/diese-tech/franks-retirement-home/issues/37) | [DOCS] Author docs/review-queue-policy.md |
| 5  | [#38](https://github.com/diese-tech/franks-retirement-home/issues/38) | [DOCS] Author docs/forgelens-worker-architecture.md |
| 6  | [#39](https://github.com/diese-tech/franks-retirement-home/issues/39) | [DOCS] Author docs/season-9-migration-runbook.md |
| 7  | [#40](https://github.com/diese-tech/franks-retirement-home/issues/40) | [DOCS] Author docs/discord-webhook-notifications-plan.md |
| 8  | [#41](https://github.com/diese-tech/franks-retirement-home/issues/41) | [DATA] Add Season + Team + TeamMember models |
| 9  | [#42](https://github.com/diese-tech/franks-retirement-home/issues/42) | [PAGE] Public Teams page + Team detail page |
| 10 | [#43](https://github.com/diese-tech/franks-retirement-home/issues/43) | [ADMIN] Admin overview dashboard |
| 11 | [#44](https://github.com/diese-tech/franks-retirement-home/issues/44) | [OPS] Define captain-side review boundaries |
| 12 | [#45](https://github.com/diese-tech/franks-retirement-home/issues/45) | [DATA] Add Match + Game models + admin schedule editor |
| 13 | [#46](https://github.com/diese-tech/franks-retirement-home/issues/46) | [PAGE] Public Schedule page + Match detail page |
| 14 | [#47](https://github.com/diese-tech/franks-retirement-home/issues/47) | [NAV] Mature navigation: active states, mobile hamburger, full link set |
| 15 | [#48](https://github.com/diese-tech/franks-retirement-home/issues/48) | [OPS] Stream URL field on matches; minimal Watch awareness |
| 16 | [#49](https://github.com/diese-tech/franks-retirement-home/issues/49) | [DRAFT] Bind drafts to a Game; prepopulate from team rosters |
| 17 | [#50](https://github.com/diese-tech/franks-retirement-home/issues/50) | [DRAFT] Shift vault scope from per-Draft to per-Match |
| 18 | [#51](https://github.com/diese-tech/franks-retirement-home/issues/51) | [DRAFT] Refactor DraftPick to team-level; add Lineup Confirmation view |
| 19 | [#52](https://github.com/diese-tech/franks-retirement-home/issues/52) | [OPS] MatchSubmission + SubmissionAttachment + screenshot upload |
| 20 | [#53](https://github.com/diese-tech/franks-retirement-home/issues/53) | [OPS] Review queue UI + manual approval flow |
| 21 | [#54](https://github.com/diese-tech/franks-retirement-home/issues/54) | [DATA] StatLine model + manual stat entry form |
| 22 | [#55](https://github.com/diese-tech/franks-retirement-home/issues/55) | [OPS] Audit log scaffold — capture now, surface later |
| 23 | [#56](https://github.com/diese-tech/franks-retirement-home/issues/56) | [OPS] Standings recompute service |
| 24 | [#57](https://github.com/diese-tech/franks-retirement-home/issues/57) | [PAGE] Standings page — public + admin recompute |
| 25 | [#58](https://github.com/diese-tech/franks-retirement-home/issues/58) | [UX] Homepage redesign for League Ops |
| 26 | [#59](https://github.com/diese-tech/franks-retirement-home/issues/59) | [PAGE] Public Players page |
| 27 | [#60](https://github.com/diese-tech/franks-retirement-home/issues/60) | [OPS] CSV exports — approved-only standings, schedule, roster, season stats |
| 28 | [#61](https://github.com/diese-tech/franks-retirement-home/issues/61) | [OPS] Pending OCR CSV export — admin-only, marked PENDING |
| 29 | [#62](https://github.com/diese-tech/franks-retirement-home/issues/62) | [OPS] CSV import path for stats — fallback when ForgeLens is down |
| 30 | [#63](https://github.com/diese-tech/franks-retirement-home/issues/63) | [DATA] OcrExtraction + ExtractedStatLine schema + PlayerAlias |
| 31 | [#64](https://github.com/diese-tech/franks-retirement-home/issues/64) | [FORGELENS] Author ForgeLens callback contract test fixtures |
| 32 | [#65](https://github.com/diese-tech/franks-retirement-home/issues/65) | [FORGELENS] Hybrid OCR integration v1 — jobs, callbacks, signed auth |

## Architecture decisions (binding)

These decisions hold across every issue below. Any deviation requires an explicit re-plan, not a one-off.

- **FRH is the source of truth for League Ops.** Seasons, teams, matches, games, drafts, submissions, standings, and approved stats all live in FRH's Neon/Postgres database.
- **FRH stays on Prisma + Neon.** Do not migrate to Supabase. SAL's stack choice is irrelevant.
- **ForgeLens is an external OCR/stat extraction worker.** Not the system of record. Calls Gemini. Returns raw + parsed output to FRH for review.
- **Gemini is invoked only by ForgeLens.** Never by FRH. The Gemini API key never enters FRH's environment.
- **CSV/Excel is first-class.** Approved-only public exports vs admin-only pending/raw exports must be visually and structurally distinguished.
- **Human-in-the-loop review is mandatory** for every stat-affecting record. OCR, CSV imports, manual entries, and screenshot-derived data all traverse the review queue before becoming canonical.
- **Pending OCR/imported data lives in staging tables**, not status-flagged canonical rows. Public pages and exports never read staging tables.
- **No auto-approval of OCR results.** Ever. Approval is unconditional and human.
- **The standalone draft flow is preserved.** Match-bound drafts are added alongside it; standalone drafts remain the fallback for scrimmages and testing.
- **The retro/early-internet visual identity stays.** RetroWindow, BrutalButton, PixelBadge are the kit. SAL's visual language is not borrowed.

---

## Labels used by this backlog

| Label | Meaning |
|---|---|
| `ux` | User-facing visual or interaction work |
| `docs` | Documentation file or policy doc |
| `data` | Prisma schema or data model change |
| `page` | New public-facing route |
| `admin` | Admin-only UI or workflow |
| `ops` | League operations: submissions, review, exports |
| `draft` | Draft engine work |
| `forgelens` | ForgeLens worker integration |
| `nav` | Navigation / layout shell |
| `p0` | Must ship for S9 launch; blocking |
| `p1` | Must ship for S9 launch; high priority |
| `p2` | Should ship for S9 launch; can land mid-sprint |
| `p3` | Stretch / post-S9 |

The bulk-create script will create any missing labels with sensible colors before creating issues.

---

## Chunk 0 — Immediate live draft UX fixes

These are independent of the data-model work. Land first.

### 1. [UX] Fix page-scroll snap on draft lock-in

**Labels:** `ux`, `p0`

**Objective**
Stop the page from jumping to the bottom of the viewport every time a chat or state update arrives via SSE. The chat panel's internal message list should scroll on its own without dragging the page.

**Scope**
- `app/draft/[id]/components/ChatPanel.js` only.
- Replace the current `bottomRef.current?.scrollIntoView({ behavior: 'smooth' })` pattern with a scoped manual scroll: `messagesRef.current.scrollTop = messagesRef.current.scrollHeight` keyed on the `chats` dependency.

**Out of scope**
- RetroWindow component.
- SSE backend, polling cadence, message payloads.
- Chat send/receive logic.
- Any other view.

**Why it matters**
Captains lose visual context on every lock-in. Hostile UX during the most-active part of the draft. This is a *separate* bug from the ChatPanel layout fix shipped in PRs #31/#32 — that fix corrected the panel's flex/scroll containment; this fixes the page-jump caused by `scrollIntoView` reaching beyond the panel.

**Acceptance criteria**
- After a captain locks in a god, the page viewport does not move.
- The chat panel's internal message list scrolls to the latest message.
- Chat send still works exactly as before.
- `npm run build` passes.

**Validation steps**
1. Open a draft as admin in tab A and as captainA in tab B.
2. In tab A, scroll the page so the chat panel is just above the fold.
3. In tab B, lock in a god during pick phase.
4. Confirm tab A's page viewport does not jump; the chat panel's internal scroll updates instead.
5. Repeat for ban phase.

**Dependencies**
None.

---

### 2. [UX] Fix blurry ban-phase god images

**Labels:** `ux`, `p1`

**Objective**
Match BanView image quality to PickView. Ban grid icons currently render blurry because `GodImage` is rasterized at a fixed 48px and then CSS-stretched to the cell size.

**Scope**
- `components/GodImage.js`: add a `fill` mode that uses `next/image` `fill` + `sizes`, matching the pattern in `GodWideArt`.
- `app/draft/[id]/views/BanView.js`: switch the god grid to use the new fill mode, or pass a `size` value matching the actual rendered cell width.

**Out of scope**
- Other views.
- Smitefire URL changes or new image sources.
- Image fallback behavior beyond what already exists.
- PickView (already correct via `GodWideArt`).

**Why it matters**
The draft room is the most-watched UI during a league night. Blurry art on the ban grid undermines product credibility precisely when the product is most visible.

**Acceptance criteria**
- Ban-phase god grid images are visually crisp at the rendered cell size on desktop and mobile.
- Image error fallback still works (initial-letter tile).
- `npm run build` passes.

**Validation steps**
1. Open a draft in banning phase.
2. Compare ban grid icons to pick grid icons side by side. Confirm parity.
3. Resize the viewport from 320px to 1920px. Confirm crispness across breakpoints.
4. Force an image load failure (devtools network blocking) and confirm the fallback tile renders.

**Dependencies**
None.

---

### 3. [UX] Collapsible / docked chat panel — LoL-style

**Labels:** `ux`, `p2`

**Objective**
Convert the chat panel from an always-visible 256px-tall block into a docked pill that expands on click. Unread badge on the pill. Click outside or Escape collapses.

**Scope**
- `app/draft/[id]/components/ChatPanel.js`
- `app/draft/[id]/DraftClient.js`
- Optional new `ChatDock` wrapper component.
- Keep the retro visual language: RetroWindow chrome with a yellow/orange titlebar so the expanded panel reads as "ALERT — new message in chat."

**Out of scope**
- Chat send/receive logic.
- RetroWindow component API changes.
- API routes, SSE, draft state.

**Why it matters**
Reclaims vertical space below the draft views, eliminates layout shift on chat updates, and matches the convention game players already know from LoL/Dota.

**Acceptance criteria**
- The chat is collapsed by default to a docked pill in a corner of the draft view.
- Click on the pill expands the chat as a floating overlay anchored to that corner.
- Unread message count appears on the pill when collapsed.
- Click outside the expanded panel or press Escape collapses it.
- Send-on-Enter behavior is preserved exactly.
- `npm run build` passes.

**Validation steps**
1. Open a draft as admin and as a captain in two tabs.
2. Send a message from one tab; confirm the other tab's docked pill shows an unread badge.
3. Click the pill in the receiving tab. Confirm the panel expands.
4. Press Escape. Confirm the panel collapses.
5. Click outside an expanded panel. Confirm it collapses.
6. Confirm the draft views below do not shift when the chat opens or closes.

**Dependencies**
Issue #1 (#1 must land first so the scroll-snap fix applies inside the new docked panel).

---

## Chunk 1 — Policy and architecture docs

Documents must land before any code that depends on them.

### 4. [DOCS] Author docs/review-queue-policy.md

**Labels:** `docs`, `p1`

**Objective**
Codify human-in-the-loop approval as a binding policy. Pending, OCR-derived, and imported stat-affecting data must never become canonical without explicit admin approval. Public pages, exports, and standings must never read pending tables.

**Scope**
- New file: `docs/review-queue-policy.md`.
- Sections:
  - What counts as "stat-affecting" data.
  - The staging-table-vs-status-flag decision and rationale (separation, not a flag).
  - Who can approve (admin only) and the captain-side review boundary (decision deferred to issue #11).
  - Pending data is invisible to public queries.
  - Rejection retention rules.
  - Supersede semantics.
  - Reconciliation expectations between FRH and ForgeLens-derived CSVs.

**Out of scope**
- Code.
- Schema changes.
- UI mockups.
- Auth changes.
- ForgeLens-specific contract details (that's #5).

**Why it matters**
Without a written policy, future contributors will bypass the queue, add a "quick admin override," or query staging tables from public routes and corrupt the season's records. The doc is the reviewer's reference when rejecting future PRs that violate the boundary.

**Acceptance criteria**
- File exists at `docs/review-queue-policy.md`.
- All sections above are populated with prose, not just headings.
- Doc is linked from `README.md` under a "League Ops policies" subsection.
- `npm run build` passes (docs are not in the build, but verify nothing regresses).

**Validation steps**
1. Read the file end to end. Confirm every section above has substantive content.
2. Confirm the link from `README.md` works in GitHub's rendered preview.

**Dependencies**
None.

---

### 5. [DOCS] Author docs/forgelens-worker-architecture.md

**Labels:** `docs`, `forgelens`, `p1`

**Objective**
Define ForgeLens as the OCR/stat extraction worker. Establish FRH as the source of truth, Neon as the canonical database, ForgeLens as the Gemini caller, and CSV/Excel as the export/fallback layer. Lock down the data contract in writing before any integration work.

**Scope**
- New file: `docs/forgelens-worker-architecture.md`.
- Required sections (see audit for full outline):
  - Purpose
  - System Responsibilities (FRH, ForgeLens, Gemini, Neon, CSV/Excel, Discord)
  - Data Flow (10-step submission → review → approval lifecycle)
  - Job Lifecycle (queued → processing → completed → failed → needs_review → approved → rejected → superseded)
  - Review Queue
  - Data Contract Draft (request, success callback, failure callback payloads)
  - Failure Modes
  - CSV/Excel Role
  - Security / Auth (HMAC callback signing, Gemini key isolation, attachment URL TTL)
  - Implementation Phases

**Out of scope**
- Code.
- Schema migrations.
- Real ForgeLens API URL or production endpoints.

**Why it matters**
Two services iterating without a written contract drift. This doc is the binding interface between FRH and ForgeLens and the reference for issue #31 (fixtures) and #32 (integration).

**Acceptance criteria**
- File exists at `docs/forgelens-worker-architecture.md`.
- All sections from the audit outline are populated.
- The data contract section includes example JSON payloads for request, success callback, and failure callback.
- The doc is linked from `README.md`.

**Validation steps**
1. Read the file end to end. Confirm every section is present and substantive.
2. Verify example payloads are valid JSON (paste into a JSON validator).
3. Confirm the doc is referenced from `docs/season-9-backlog.md` and `README.md`.

**Dependencies**
None.

---

### 6. [DOCS] Author docs/season-9-migration-runbook.md

**Labels:** `docs`, `data`, `p1`

**Objective**
Document the staged Prisma migration sequence (Season → Team → Match → Game → submission/extraction/StatLine → DraftPick relax). Each step has a pre-migration check, the migration command, a post-migration verification query, and a rollback plan.

**Scope**
- New file: `docs/season-9-migration-runbook.md`.
- Per-step content for migrations that will be performed in issues #8, #12, #18, #19, #21, #30.
- Explicitly mark the one destructive step (DraftPick `playerId` nullable + drop unique) as **pre-season only**.
- Capture the rule: mid-season migrations are additive only.

**Out of scope**
- Running the migrations (those are owned by the data issues).
- Schema design discussion (that lives in the audit and in each data issue's scope).

**Why it matters**
Migrating a live database during a multi-week sprint without a runbook is how production data gets lost. This is the operational playbook for #8, #12, #18, #19, #21, #30.

**Acceptance criteria**
- File exists at `docs/season-9-migration-runbook.md`.
- Each migration has: pre-check, command, post-check, rollback.
- The destructive step is explicitly flagged.
- The "additive-only mid-season" rule is stated as a binding policy.

**Validation steps**
1. Read end to end.
2. Cross-check each migration step against the corresponding data issue's scope.
3. Confirm the rollback plans don't reference Supabase or any other foreign stack.

**Dependencies**
Issue #4 (`docs/review-queue-policy.md`) — the runbook references its policies.

---

### 7. [DOCS] Author docs/discord-webhook-notifications-plan.md

**Labels:** `docs`, `ops`, `p3`

**Objective**
Plan-only doc for sending match results, draft completions, and weekly summaries to a configurable Discord webhook. No implementation in S9.

**Scope**
- New file: `docs/discord-webhook-notifications-plan.md`.
- Event list, payload sketch, opt-in config (per-server URL), failure isolation rules (Discord down ≠ FRH down), opt-out path.

**Out of scope**
- Implementation.
- Discord OAuth, multi-channel routing.

**Why it matters**
Discord is the league's social layer. Plan now so the data shape supports webhook emission; ship after S9 once stat volume justifies it.

**Acceptance criteria**
- File exists.
- Event types documented with example payloads.
- Failure isolation explicitly stated.

**Validation steps**
1. Read end to end.
2. Confirm no implementation work is implied.

**Dependencies**
Issue #5 — the doc references the FRH/ForgeLens architecture.

---

## Chunk 2 — Season and roster foundation

### 8. [DATA] Add Season + Team + TeamMember models

**Labels:** `data`, `admin`, `p0`

**Objective**
Introduce the season-scoped persistent team primitives. Backfill a Season 9 row. Add an admin tab to manage teams and rosters.

**Scope**
- Prisma schema additions:
  - `Season` (id, name, slug, status, startsAt, endsAt, currentWeek, createdAt)
  - `Team` (id, seasonId, name, tag, accentColor, captainPlayerId nullable)
  - `TeamMember` (id, teamId, playerId, role, isCaptain, isSub, joinedAt, leftAt nullable)
- Prisma migration following the runbook from #6.
- Seed: insert Season 9 row.
- Admin UI tab: "Teams" with CRUD for teams + member assignment from the existing player pool.
- API routes: `/api/seasons`, `/api/teams` (admin-gated), `/api/teams/:id/members`.

**Out of scope**
- Match, Game, Draft binding.
- Public Teams page (that's #9).
- Standings.
- Logos or brand kits beyond an `accentColor` token from the FRH palette.

**Why it matters**
Every other Season 9 capability hangs off these models. Without them no match, schedule, draft binding, or standings can exist.

**Acceptance criteria**
- Migration runs cleanly on a fresh DB.
- Migration runs cleanly on a database that already contains the existing draft system (`Draft`, `DraftPick`, `DraftBan`, `Player`, `God`).
- Season 9 row exists after seed.
- Admin can create a team, add players to it, mark a captain, mark a sub.
- `npm run build` and `npm run lint` pass.

**Validation steps**
1. Run `npx prisma migrate dev` on a fresh DB; confirm tables.
2. Run on a copy of an existing draft DB; confirm no data loss.
3. Open `/admin`, navigate to the Teams tab. Create a test team with 5 players + 1 captain. Confirm it persists.
4. Confirm `requireAdmin` gates the new endpoints.

**Dependencies**
Issue #6 (migration runbook).

---

### 9. [PAGE] Public Teams page + Team detail page

**Labels:** `page`, `ux`, `p1`

**Objective**
Add `/teams` and `/teams/[id]` as read-only public pages. Show team name, tag, accent color, roster, captain, and a record placeholder (W-L appears post-#23).

**Scope**
- New routes: `app/teams/page.js`, `app/teams/[id]/page.js`.
- Use existing RetroWindow / PixelBadge / BrutalButton components.
- Filter teams by current season (default).

**Out of scope**
- Edit flows (admin-only and lives in #8).
- Standings (separate, #24).
- Team brand kits (logos, banners).
- Per-player stat history.

**Why it matters**
Players need to see their team's roster and confirm assignment. First public read surface for the season model.

**Acceptance criteria**
- `/teams` lists all current-season teams with a link to each detail page.
- `/teams/[id]` shows roster with role + captain indicator.
- Mobile layout works at 375px.
- Pages do not query staging tables.
- `npm run build` passes.

**Validation steps**
1. Visit `/teams` with seed data. Confirm team list.
2. Click into a team. Confirm roster and captain badge.
3. Verify SSR keys are stripped (no `adminKey`-style leaks).
4. Test at 375px viewport.

**Dependencies**
Issue #8.

---

### 10. [ADMIN] Admin overview dashboard

**Labels:** `admin`, `ux`, `p2`

**Objective**
Add a stat-card row + quick-action grid to the admin landing before the existing tabs. Displays counts of active matches, pending submissions, current week, total players, total teams, total gods.

**Scope**
- `app/admin/AdminClient.js` extension.
- Use RetroWindow + PixelBadge + BrutalButton; no new components.
- Data sources: existing Prisma counts + new Season/Team/Match counts.

**Out of scope**
- Audit log surface (that's the eventual UI for #22).
- Activity feed.
- Redesign of any existing tab content.

**Why it matters**
Commissioner orientation. Reflects the S9 ops surface immediately on landing rather than dropping the admin into a tab strip.

**Acceptance criteria**
- Admin landing shows the stat row above the tab bar.
- Quick-action cards link to the most-used flows (Create Match, Open Review Queue, View Schedule).
- "Pending submissions" count shows zero before #19 lands and the real number after.
- `npm run build` passes.

**Validation steps**
1. Open `/admin` after login.
2. Confirm stat cards render with live counts from the DB.
3. Click each quick-action card; confirm correct destination.

**Dependencies**
Issue #8.

---

### 11. [OPS] Define captain-side review boundaries

**Labels:** `ops`, `docs`, `p3`

**Objective**
Decision/spec issue. Decide whether captains can correct their own roster's stat rows pre-approval (and what fields are editable), or whether all corrections route through admin. Implementation deferred unless explicitly approved.

**Scope**
- Decision write-up appended to `docs/review-queue-policy.md`.
- If approved: a one-paragraph spec for the eventual UI scope (which fields are captain-editable, which are admin-only).
- If deferred: explicit "S9 = admin-only review" line in the policy doc.

**Out of scope**
- Implementation (separate future issue if approved).
- New role models or User table refactor.

**Why it matters**
"Captains submit + admins approve" is the simplest legitimate model. Captain self-correction reduces admin load but adds a trust surface. Decide deliberately, document the choice, don't drift into it.

**Acceptance criteria**
- Decision documented in `docs/review-queue-policy.md`.
- If "yes," scope of editable fields is enumerated.
- If "no," the policy doc states S9 is admin-only.

**Validation steps**
1. Read the policy doc and confirm the decision is explicit.

**Dependencies**
Issue #4 (`docs/review-queue-policy.md` exists).

---

## Chunk 3 — Match and schedule foundation

### 12. [DATA] Add Match + Game models + admin schedule editor

**Labels:** `data`, `admin`, `p0`

**Objective**
Introduce scheduled matches and per-match games. Add admin CRUD for schedules, including week, status, home/away teams, format (BO1/BO3/BO5), stream URL, and VOD URL.

**Scope**
- Prisma additions:
  - `Match` (id, seasonId, week, scheduledAt, status, homeTeamId, awayTeamId, format, streamUrl, vodUrl)
  - `Game` (id, matchId, gameNumber, winnerTeamId nullable, durationSeconds nullable)
- Migration via runbook.
- Admin schedule editor: list, create, edit, delete matches; manage games per match.
- API routes: `/api/matches`, `/api/matches/:id`, `/api/matches/:id/games` (admin-gated).
- Status transitions: scheduled → live → completed → postponed.

**Out of scope**
- Public schedule page (#13).
- Match-bound draft creation (#16).
- Submissions (#19).
- Twitch API integration.

**Why it matters**
Drafts need a parent. Submissions need a target. Without Match/Game, nothing else in chunks 4–6 can land.

**Acceptance criteria**
- Migration runs cleanly.
- Admin can create a match between two existing teams, schedule it for a date/time, set BO format, and add games.
- Admin can transition match status manually for now (live/completed automated later).
- `npm run build` and `npm run lint` pass.

**Validation steps**
1. Run migration on a fresh DB and on a DB with existing teams.
2. Create a Week 1 match between two teams via admin. Verify it persists.
3. Add Game 1, Game 2, Game 3 to a BO5 match. Verify game numbers increment.
4. Transition status through all four values.

**Dependencies**
Issue #8.

---

### 13. [PAGE] Public Schedule page + Match detail page

**Labels:** `page`, `ux`, `p1`

**Objective**
Add `/schedule` and `/matches/[id]`. Show week/status filters, both team rosters, scheduled time, stream link if set, match status, and stub placeholders for draft and result data (filled in by later chunks).

**Scope**
- New routes: `app/schedule/page.js`, `app/matches/[id]/page.js`.
- Filters: week, status.
- Stream URL renders as a link badge when set.

**Out of scope**
- Twitch API live status.
- ICS export.
- Submission UI.
- Draft creation from match (#16).

**Why it matters**
Captains and players need to see their week. The schedule is the primary navigation entry point during the season.

**Acceptance criteria**
- `/schedule` lists current-season matches grouped or filterable by week.
- Match detail shows both teams, time, status, stream URL.
- Stub placeholders ("Draft pending", "Result pending") render where data is missing.
- Mobile works at 375px.
- `npm run build` passes.

**Validation steps**
1. Seed two teams + a Week 1 match.
2. Visit `/schedule`. Confirm match appears under Week 1.
3. Visit `/matches/[id]`. Confirm both rosters render.
4. Set a streamUrl in admin. Confirm link badge appears.
5. Test at 375px.

**Dependencies**
Issue #12.

---

### 14. [NAV] Mature navigation: active states, mobile hamburger, full link set

**Labels:** `nav`, `ux`, `p1`

**Objective**
Expand nav to include `/`, `/standings`, `/schedule`, `/teams`, `/players`, `/admin`. Add active-page indicator. Add mobile hamburger menu.

**Scope**
- `components/Nav.js`.
- Use `usePathname` for active state.
- Mobile menu uses retro styling (BrutalButton-toned hamburger, RetroWindow drawer).

**Out of scope**
- Auth UI changes.
- Breadcrumbs.
- Search bar.

**Why it matters**
The page count is growing fast. Nav has to keep up. Active state and mobile menu are baseline expectations.

**Acceptance criteria**
- Desktop nav shows all six links with active-page styling.
- Mobile shows a hamburger that toggles a drawer with the same links.
- Links point to existing pages (or rendered placeholders if a page hasn't shipped — links don't 404).
- `npm run build` passes.

**Validation steps**
1. Visit each route in turn; confirm the active link is visually distinct.
2. Resize to 375px; confirm hamburger appears and drawer works.
3. Confirm Escape closes the drawer.

**Dependencies**
Issue #9 (Teams pages exist) and #13 (Schedule pages exist) for the links to resolve. Nav can be implemented in parallel; visual confirmation of active states needs the routes.

---

### 15. [OPS] Stream URL field on matches; minimal Watch awareness

**Labels:** `ops`, `ux`, `p2`

**Objective**
Render `streamUrl` and `vodUrl` (already on Match from #12) on the homepage and match pages where set. Zero Twitch API integration.

**Scope**
- Match detail: link badge with retro styling.
- Homepage live/upcoming sections (when those land in #25): "Watch" link badge.
- Optional: a tiny `/watch` redirect that resolves to the current-week's primary stream URL if any.

**Out of scope**
- Twitch API OAuth.
- Live viewer count.
- Embedded Twitch player.

**Why it matters**
Broadcast awareness with zero infra cost. Captains and viewers need a one-click link.

**Acceptance criteria**
- A match with a `streamUrl` shows a styled link on its detail page.
- A match without one shows nothing (no broken-link placeholder).
- `npm run build` passes.

**Validation steps**
1. Set a streamUrl on a match via admin.
2. Visit the match page. Click the link. Confirm it opens Twitch.
3. Clear the streamUrl. Confirm no link renders.

**Dependencies**
Issue #12.

---

## Chunk 4 — Match-bound drafts

### 16. [DRAFT] Bind drafts to a Game; prepopulate from team rosters

**Labels:** `draft`, `data`, `p1`

**Objective**
Add a nullable `gameId` to `Draft`. New admin flow: from the Match detail page, "Open Draft for Game N" creates a Draft tied to that Game and prepopulates Team A/B from the Match's team rosters. The standalone draft flow remains intact for scrimmages.

**Scope**
- Schema: `Draft.gameId` nullable FK to `Game`.
- Migration via runbook.
- Admin flow: button on `/matches/[id]` per game that creates the draft and redirects to the draft room.
- Auto-population logic: pull `TeamMember` rows for `Match.homeTeamId` and `Match.awayTeamId` filtered to current/active members; create `DraftPick` rows for the 5 starters per side.
- Captain keys generated as today.

**Out of scope**
- Team-level pick refactor (#18).
- Vault-scope shift (#17).
- Submission and review (#19, #20).

**Why it matters**
Removes manual roster assembly. Eliminates wrong-team bugs that would otherwise plague a 16-team season.

**Acceptance criteria**
- A draft created from a Game has `gameId` set and Team A/B populated from team rosters.
- A standalone draft created from `/admin` Drafts tab works exactly as today (gameId null).
- Captain keys are generated and shareable.
- `npm run build` passes.

**Validation steps**
1. Create a Match with two teams in admin.
2. Open the Match detail page; click "Open Draft for Game 1."
3. Confirm draft room loads with Team A/B prefilled with 5 players each.
4. Confirm `Draft.gameId` is set in the DB.
5. Create a standalone draft. Confirm it works as before with `gameId = null`.

**Dependencies**
Issue #12.

---

### 17. [DRAFT] Shift vault scope from per-Draft to per-Match

**Labels:** `draft`, `p1`

**Objective**
For match-bound BO3/BO5 drafts, the god vault (`usedGodIds`) spans all Games of the same Match. A god picked in Game 1 is unavailable in Games 2 and 3 of the same Match. Standalone drafts continue to vault per-Draft.

**Scope**
- Update vault read logic to aggregate `usedGodIds` across all `Game.matchId` siblings when a Draft has `gameId` set.
- Update vault write logic to write to the active Draft as today.
- Standalone draft path (Draft.gameId null) keeps current per-Draft semantics.

**Out of scope**
- Schema changes (no new columns required; the aggregation is a query-side change).
- UI labeling beyond the existing "Vaulted" treatment.

**Why it matters**
A real BO3 between Team Canes and Team Walker should not let Hercules reappear in Game 2 after being picked in Game 1. This is a league rule, not optional.

**Acceptance criteria**
- A god picked in Game 1 of a match-bound BO3 is marked as Vaulted in Game 2's draft room.
- The same god in a standalone draft continues to vault per-Draft only.
- `npm run build` passes.

**Validation steps**
1. Create a BO3 match. Open Game 1 draft, pick Hercules for Team A.
2. Open Game 2 draft for the same match. Confirm Hercules shows as Vaulted.
3. Create a separate standalone draft. Pick Hercules. Open another standalone draft. Confirm Hercules is *not* vaulted (separate vault scope).

**Dependencies**
Issue #16.

---

### 18. [DRAFT] Refactor DraftPick to team-level; add Lineup Confirmation view

**Labels:** `draft`, `data`, `p1`

**Objective**
Make `DraftPick.playerId` nullable. Drop the `@@unique([draftId, playerId])` constraint or condition it on `playerId IS NOT NULL`. Update the PickView UI to record picks at team level (no player attached during draft). Add a post-draft Lineup Confirmation view where captains assign their 5 players to the 5 picked gods.

**Scope**
- Schema: `DraftPick.playerId` nullable; constraint dropped/conditional. Migration via runbook.
- PickView UI: pick rows show team + god, no player name during draft.
- New post-draft step or view: captain assigns the 5 players to the 5 picked gods. Updates `DraftPick.playerId`.
- Backwards-compatible: existing drafts with player-locked picks continue to render correctly.

**Out of scope**
- OCR-driven assignment (#32).
- Submission flow (#19).
- Auto-detection of player-god mapping from screenshots.

**Why it matters**
This is the highest-risk piece of S9 work. It touches the most-tested code path. It also reflects how Smite drafting actually happens — gods are picked, players are assigned later. Required to enable OCR-inferred mappings down the line.

**Acceptance criteria**
- Migration runs cleanly. Existing player-locked picks remain valid (their `playerId` stays set).
- New picks can be recorded with `playerId` null.
- PickView shows team-level pick rows during the draft.
- A "Lineup Confirmation" UI is reachable after the draft completes; captains can assign their 5 players to gods.
- After confirmation, `DraftPick.playerId` is populated for those rows.
- `npm run build`, `npm run lint`, and a full BO1 dry-run pass without errors.

**Validation steps**
1. Run migration on a copy of production-like DB. Verify zero data loss.
2. Run a full standalone draft pending → complete with the new UI.
3. Run a full match-bound draft pending → complete.
4. Use the Lineup Confirmation view to assign players. Verify DB rows update.
5. Skip the Lineup Confirmation; verify the draft still completes (mapping comes later via OCR or submission).

**Dependencies**
Issue #16, #17.

---

## Chunk 5 — Match submission and review queue

### 19. [OPS] MatchSubmission + SubmissionAttachment + screenshot upload

**Labels:** `ops`, `data`, `p0`

**Objective**
Captains submit match results. Each submission includes a reported winner, optional notes, and one or more screenshot attachments. Stored in FRH; no OCR yet.

**Scope**
- Schema additions:
  - `MatchSubmission` (id, matchId, gameId nullable, submittedByPlayerId, status, reportedWinnerTeamId, notes, createdAt, reviewStartedAt, reviewedAt, reviewedByAdminId, rejectionReason)
  - `SubmissionAttachment` (id, submissionId, kind, url, checksum, mimeType, byteSize, uploadedAt)
- Migration via runbook.
- Captain UI: submission form on `/matches/[id]`.
- Screenshot upload to Vercel Blob (or comparable; isolate behind a helper).
- API routes: `/api/matches/:id/submissions` (captain-key gated), `/api/submissions/:id` (admin or owning captain).

**Out of scope**
- Review approval workflow (#20).
- OCR job creation (#32).
- StatLine (#21).

**Why it matters**
Without this, the league cannot record any results in FRH at all.

**Acceptance criteria**
- Captain can submit a winner + notes + screenshots for a match.
- Screenshots upload successfully and the URL is stored.
- Submission appears in the DB with `status = pending`.
- `npm run build` passes.

**Validation steps**
1. As a captain, open a match detail page after the match has been played.
2. Submit a winner with two screenshot uploads.
3. Verify rows in MatchSubmission and SubmissionAttachment.
4. Verify the screenshot URLs resolve.
5. Try submitting without auth; confirm 401.

**Dependencies**
Issue #12.

---

### 20. [OPS] Review queue UI + manual approval flow

**Labels:** `ops`, `admin`, `p0`

**Objective**
Admin reviews pending submissions, approves or rejects, optionally edits fields, and triggers standings recompute on approval.

**Scope**
- Admin tab "Review Queue" listing pending submissions.
- Per-submission detail view: see attachments, reported winner, notes.
- Actions: approve (sets `Game.winnerTeamId`, transitions submission status, triggers standings recompute), reject (with reason), supersede (mark old as superseded when a new submission lands).
- Status transitions: pending → in_review → approved | rejected | superseded.

**Out of scope**
- OCR ingestion (#32).
- Captain self-review (decision in #11).
- StatLine entry (#21 — this issue covers the winner only; stats follow).

**Why it matters**
The review queue is the canonical correctness gate for the entire league. Every other approval flow funnels through it.

**Acceptance criteria**
- Admin can see all pending submissions in a queue.
- Approve writes `Game.winnerTeamId` and recomputes standings.
- Reject preserves the submission with `status = rejected` and a reason.
- Superseded submissions remain queryable for audit.
- Pending submissions never affect standings or public match pages.
- `npm run build` passes.

**Validation steps**
1. Captain submits a result via #19.
2. Admin opens Review Queue; sees the pending submission.
3. Approve. Confirm Game.winnerTeamId is set. Confirm standings (when #23 lands) reflect the win.
4. Reject a different submission. Confirm `status = rejected` with reason.
5. Confirm a superseded submission is preserved.

**Dependencies**
Issue #4 (policy doc), #19.

---

### 21. [DATA] StatLine model + manual stat entry form

**Labels:** `data`, `ops`, `admin`, `p0`

**Objective**
Add the canonical approved stat row primitive. Add an admin manual stat entry form so the league can record per-game player stats even before ForgeLens is wired.

**Scope**
- Schema: `StatLine` (id, gameId, teamId, playerId, godId, role, kills, deaths, assists, damageDealt, damageMitigated, healing, goldEarned, structureDamage, source, sourceExtractionId nullable, approvedByAdminId, approvedAt, createdAt). Migration via runbook.
- Admin UI: per-game stat entry form integrated into the Review Queue submission detail view. Fields per player.
- Approval of a submission with manual stats writes StatLine rows alongside the Game.winnerTeamId update.

**Out of scope**
- ExtractedStatLine staging (that's #30).
- OCR ingestion (#32).
- Public stat pages (post-S9).

**Why it matters**
OCR is a stretch goal. Manual stat entry is the floor. Without it, the league has zero stat history for S9 even if ForgeLens never ships.

**Acceptance criteria**
- Admin can enter per-player stats for a game during submission review.
- On approval, StatLine rows are created with `source = 'manual'`.
- StatLine rows are visible on a (future) match detail or admin page.
- `npm run build` passes.

**Validation steps**
1. Approve a submission and enter stats for 10 players (5 per team).
2. Verify 10 StatLine rows in the DB with `source = 'manual'`.
3. Confirm pending submissions never have StatLine rows attached.

**Dependencies**
Issue #20.

---

### 22. [OPS] Audit log scaffold — capture now, surface later

**Labels:** `ops`, `data`, `p2`

**Objective**
Add a lightweight `AuditLog` table and a helper to capture every status transition on `MatchSubmission`, `OcrExtraction`, `ExtractedStatLine`, and `StatLine`. No reader UI in S9.

**Scope**
- Schema: `AuditLog` (id, entityType, entityId, action, actorAdminId nullable, actorPlayerId nullable, fromStatus, toStatus, payload jsonb, createdAt).
- Helper: `lib/audit.js` with a single `recordTransition()` function called from approval/rejection paths.
- No UI.

**Out of scope**
- Reader UI.
- Per-row diffing.
- Retention policy.

**Why it matters**
When a commissioner asks "how did Team Walker's Week 3 result get changed?" three weeks into the season, having captured every transition since day one is the difference between answering and a forensic problem.

**Acceptance criteria**
- AuditLog rows are written on every approval, rejection, and supersede transition for the four entity types listed.
- Writing an audit row never blocks the primary action (best-effort with error logging).
- `npm run build` passes.

**Validation steps**
1. Approve a submission. Confirm an AuditLog row exists.
2. Reject a submission. Confirm a row.
3. Supersede a submission. Confirm a row.
4. Confirm payload contains relevant context (e.g., the new winnerTeamId).

**Dependencies**
Issue #20.

---

## Chunk 6 — Standings and public league ops pages

### 23. [OPS] Standings recompute service

**Labels:** `ops`, `data`, `p1`

**Objective**
Centralize standings calculation in `lib/standings.js`. Reads only approved Game.winnerTeamId rows. Caches briefly. Called from approval, rejection-of-previously-approved, manual invalidation, and an admin "recompute" button.

**Scope**
- New `lib/standings.js` module exporting a `computeSeasonStandings(seasonId)` function.
- Returns season-scoped W/L/win-pct rows per team.
- Cache for 30s (Next.js `revalidate` or in-memory TTL).
- Pure read of approved data — never reads pending tables.

**Out of scope**
- Tiebreakers beyond W/L.
- Head-to-head splits.
- Materialized standings table (defer until perf demands it).

**Why it matters**
Standings calculation scattered across approval handlers will drift. Centralize once.

**Acceptance criteria**
- Approving a submission recomputes standings.
- Rejecting a previously-approved submission recomputes standings.
- The function never queries staging tables.
- `npm run build` passes.

**Validation steps**
1. Approve two matches with different winners. Confirm standings reflect 1-0 and 0-1 records.
2. Reject one of the previously-approved submissions. Confirm standings update.
3. Confirm the cache TTL is respected (no recompute storms during heavy review).

**Dependencies**
Issue #20.

---

### 24. [PAGE] Standings page — public + admin recompute

**Labels:** `page`, `admin`, `p1`

**Objective**
Add `/standings` (public) plus an admin "Recompute Standings" button. W/L minimum, no fancy tiebreakers.

**Scope**
- New route: `app/standings/page.js`.
- Renders the standings using `lib/standings.js` from #23.
- Admin button visible only to authenticated admins; calls a recompute endpoint.

**Out of scope**
- Tiebreakers.
- Per-division splits if FRH isn't using fixed divisions for S9.

**Why it matters**
League legitimacy. The standings page is the most-checked page during a season.

**Acceptance criteria**
- `/standings` renders for unauthenticated users.
- Standings reflect approved matches only.
- Admin recompute button works and is invisible to non-admins.
- Mobile works at 375px.
- `npm run build` passes.

**Validation steps**
1. Approve some matches. Visit `/standings`. Confirm rows.
2. Verify pending submissions do not affect standings.
3. Click admin recompute. Confirm no errors and rows match.

**Dependencies**
Issue #23.

---

### 25. [UX] Homepage redesign for League Ops

**Labels:** `ux`, `page`, `p1`

**Objective**
Replace the current tabbed homepage (Drafts / How It Works / About) with stacked sections: live matches → upcoming → recent → standings preview → teams/Discord. Preserve the FRH retro identity.

**Scope**
- `app/HomepageClient.js`, `app/page.js`.
- Compose from existing primitives (RetroWindow, BrutalButton, PixelBadge, PortalTabBar can stay where useful).
- Keep retro voice in copy.

**Out of scope**
- New global components.
- Twitch API integration.
- Ticker bar.

**Why it matters**
First impression of the platform. Current homepage doesn't reflect League Ops.

**Acceptance criteria**
- Homepage shows live matches first, then upcoming, then recent, then standings preview, then a teams or Discord CTA.
- Empty states are handled (e.g., "No live matches right now. Probably for the better.").
- Retro visual identity preserved.
- Mobile works at 375px.
- `npm run build` passes.

**Validation steps**
1. With no matches scheduled, confirm sensible empty states.
2. With an upcoming match, confirm it appears in the upcoming section.
3. With a live match, confirm it pins to the top.
4. With completed matches, confirm they appear in recent.
5. Standings preview shows top 3 teams per the recompute.

**Dependencies**
Issue #13, #24.

---

### 26. [PAGE] Public Players page

**Labels:** `page`, `p3`

**Objective**
Add `/players` with filters by team, role, and season. Stretch goal for S9; useful once teams exist.

**Scope**
- New route: `app/players/page.js`.
- Read-only list with filters.
- Respects season scope (default = current).

**Out of scope**
- Player detail/profile pages.
- Per-player stat history.

**Why it matters**
Captains and players want to browse the pool. Useful for scouting, not blocking S9.

**Acceptance criteria**
- `/players` renders.
- Filters work.
- Mobile works.
- `npm run build` passes.

**Validation steps**
1. Visit `/players`.
2. Filter by team. Confirm results.
3. Filter by role.
4. Test at 375px.

**Dependencies**
Issue #8, #9.

---

## Chunk 7 — CSV / Excel operations

### 27. [OPS] CSV exports — approved-only standings, schedule, roster, season stats

**Labels:** `ops`, `p1`

**Objective**
Export approved canonical league data as CSV. Filenames clearly indicate "approved" and date. No pending data leaks.

**Scope**
- API routes returning CSV: `/api/exports/standings.csv`, `/api/exports/schedule.csv`, `/api/exports/roster.csv`, `/api/exports/stats.csv`.
- Admin UI buttons; some can be exposed publicly (standings, schedule).
- Filename convention: `frh-s9-{type}-YYYY-MM-DD.csv`.

**Out of scope**
- Excel formatting (`.xlsx`).
- ICS calendar export.
- Pending or raw exports (#28).

**Why it matters**
Spreadsheets are commissioners' trusted backup. Approved-only exports protect public-facing data integrity.

**Acceptance criteria**
- Each export route returns valid CSV with a header row.
- Pending data is structurally absent (the queries can't see staging tables).
- Filenames follow convention.
- `npm run build` passes.

**Validation steps**
1. Hit each export endpoint. Confirm CSV download.
2. Open in a spreadsheet. Confirm sensible headers and rows.
3. Confirm no pending submission data appears anywhere.

**Dependencies**
Issue #21, #24.

---

### 28. [OPS] Pending OCR CSV export — admin-only, marked PENDING

**Labels:** `ops`, `admin`, `forgelens`, `p2`

**Objective**
Allow admins to export pending/extracted rows for reconciliation against ForgeLens raw output. Filenames and columns visibly marked "PENDING / NOT OFFICIAL."

**Scope**
- Admin-only API route: `/api/exports/pending-ocr.csv`.
- Filename: `frh-s9-pending-ocr-YYYY-MM-DD.csv`.
- First column: `STATUS` containing `PENDING`.
- Banner in admin UI when downloading: "This export contains unapproved data."

**Out of scope**
- Public exposure.
- Integration with public exports.

**Why it matters**
Reconciliation between FRH staging tables and ForgeLens-known-good output is the fastest way to catch parser regressions or OCR drift.

**Acceptance criteria**
- Endpoint requires admin auth.
- Filename and STATUS column reflect pending state.
- `npm run build` passes.

**Validation steps**
1. Without auth: 401.
2. With admin auth: CSV downloads.
3. Confirm filename, STATUS column, and admin-UI banner.

**Dependencies**
Issue #30 (staging tables exist).

---

### 29. [OPS] CSV import path for stats — fallback when ForgeLens is down

**Labels:** `ops`, `admin`, `forgelens`, `p2`

**Objective**
Admin can paste or upload a ForgeLens-formatted CSV. Each row becomes an `ExtractedStatLine` with `source = 'manual_csv'`. Standard review queue applies. No auto-approval.

**Scope**
- Admin UI: paste/upload form on the Review Queue.
- API route: `/api/imports/stats` (admin-gated).
- Validation: row schema, IGN strings, god IDs.
- Rejection of malformed rows with per-row error messages.

**Out of scope**
- Public import.
- Auto-approval of CSV-imported rows.

**Why it matters**
Operational resilience. When ForgeLens is unavailable, the league still records stats by pasting CSV.

**Acceptance criteria**
- Admin can paste a CSV; rows enter as `ExtractedStatLine` pending.
- Malformed rows return clear errors and don't partially commit.
- `npm run build` passes.

**Validation steps**
1. Paste a known-good ForgeLens CSV. Confirm staging rows.
2. Paste a malformed CSV. Confirm errors.
3. Confirm staging rows never appear in standings or public exports.

**Dependencies**
Issue #30.

---

## Chunk 8 — ForgeLens / OCR pipeline

### 30. [DATA] OcrExtraction + ExtractedStatLine schema + PlayerAlias

**Labels:** `data`, `forgelens`, `p2`

**Objective**
Add staging tables for OCR/imported pending stat data and `PlayerAlias` for IGN matching. Schema only or with a minimal read-only admin view.

**Scope**
- Schema additions:
  - `OcrExtraction` (id, attachmentId, source, status, rawModelOutput jsonb, parsedRows jsonb, confidence, warnings jsonb, parserVersion, errorMessage, jobCreatedAt, jobCompletedAt, supersededByExtractionId nullable)
  - `ExtractedStatLine` (id, extractionId, gameId, teamId, godId, playerId nullable, ign, role, kills, deaths, assists, damageDealt, damageMitigated, healing, goldEarned, structureDamage, status, reviewedByAdminId nullable, reviewedAt nullable, promotedToStatLineId nullable)
  - `PlayerAlias` (id, playerId, ign, source)
- Migration via runbook.
- Optional: a read-only admin view that lists OcrExtraction rows. No mutation actions yet.

**Out of scope**
- ForgeLens job creation, callbacks (#32).
- Approval flows specific to OCR (those are extensions of #20 in #32).
- Auto-promotion of staging rows to canonical.

**Why it matters**
Splits "schema landing" from "wire integration" so each can be reviewed and shipped independently.

**Acceptance criteria**
- Migration runs cleanly.
- `npm run build` and `npm run lint` pass.
- Public routes and `lib/standings.js` cannot read these tables (verified by grep).

**Validation steps**
1. Run migration on a fresh DB.
2. Run on a DB with existing data.
3. Insert a fake OcrExtraction row directly via `prisma studio`. Confirm it does not appear in `/standings` or any public CSV export.

**Dependencies**
Issue #5, #21.

---

### 31. [FORGELENS] Author ForgeLens callback contract test fixtures

**Labels:** `forgelens`, `docs`, `p2`

**Objective**
Provide a stable set of example callback payloads (success, low-confidence, partial, failure, malformed) that FRH and ForgeLens both test against. Lives in the FRH repo as the contract source of truth.

**Scope**
- `tests/fixtures/forgelens/` directory with JSON files matching the contract from `docs/forgelens-worker-architecture.md`.
- Subset of FRH-side tests that load fixtures and exercise the (yet-to-be-built) callback handler.

**Out of scope**
- Real ForgeLens integration.
- Real Gemini calls.
- Network testing.

**Why it matters**
Two services iterating against a written contract still drift. Fixtures are the executable form. Lets ForgeLens authors verify their output shape locally without spinning up FRH.

**Acceptance criteria**
- Fixtures exist for: success, low-confidence, partial extraction, failure, malformed.
- Each fixture is valid JSON conforming to the contract in #5.
- Fixtures are referenced from `docs/forgelens-worker-architecture.md`.
- `npm run build` passes.

**Validation steps**
1. Load each fixture in Node and parse as JSON.
2. Confirm field coverage matches the contract.

**Dependencies**
Issue #5, #30.

---

### 32. [FORGELENS] Hybrid OCR integration v1 — jobs, callbacks, signed auth

**Labels:** `forgelens`, `ops`, `p2`

**Objective**
Wire the hybrid OCR architecture: FRH creates OCR jobs, posts to ForgeLens, receives signed callbacks, stores `OcrExtraction` and `ExtractedStatLine` rows in the review queue. Approval (still admin-only) promotes ExtractedStatLine → StatLine and recomputes standings.

**Scope**
- Job creation on screenshot upload: FRH POSTs to ForgeLens with the contract from #5.
- Callback receiver at `/api/forgelens/callback` with HMAC verification.
- Retry logic on ForgeLens failures (exponential backoff, max retries).
- Status transitions: queued → processing → completed | failed | needs_review → approved | rejected | superseded.
- Admin Review Queue extension: per-extraction view showing raw + parsed output, edit fields, approve to promote rows to canonical StatLine.

**Out of scope**
- Auto-approval (never).
- Public OCR dashboards.
- IGN auto-matching beyond exact string match (that's a follow-on enhancement).

**Why it matters**
Stat ingestion at scale isn't viable without automation. This is the largest single piece of S9 work, but it's also stretch — manual entry (#21) is the fallback if this slips.

**Acceptance criteria**
- An uploaded screenshot triggers a ForgeLens job.
- A successful callback creates OcrExtraction and ExtractedStatLine rows.
- A failure callback marks the extraction failed; manual entry remains available.
- Admin can review and approve; on approval, StatLine rows are written.
- HMAC-signed callbacks reject unsigned/invalid requests.
- `npm run build` passes.

**Validation steps**
1. Run against ForgeLens staging or a mock that returns one of the fixtures from #31.
2. Verify the success path: extraction → review → approve → StatLine.
3. Verify the failure path: failed extraction does not block manual entry.
4. Verify HMAC: send a forged callback; confirm 401.
5. Approve an extraction with a low-confidence warning; confirm admin saw the warning.

**Dependencies**
Issue #30, #31.

---

# Batching plan — milestones

| Milestone | Issues | Goal | Land by |
|---|---|---|---|
| **M1: Immediate Draft UX** | #1, #2, #3 | Stop the most user-hostile bugs in the live draft room. | Sprint 1 |
| **M2: Policy + Architecture Docs** | #4, #5, #6, #7 | Lock binding policies and contracts before any code that depends on them. | Sprint 1 |
| **M3: Season/Roster Foundation** | #8, #9, #10, #11 | Persistent teams + admin overview. Foundation for everything else. | Sprint 2 |
| **M4: Match/Schedule Foundation** | #12, #13, #14, #15 | Schedule entity + public schedule + matured nav. | Sprint 2–3 |
| **M5: Match-Bound Drafts** | #16, #17, #18 | Drafts inherit teams from matches; vault scopes per match; team-level picks. **Highest engine risk.** | Sprint 3 |
| **M6: Submission + Review Queue** | #19, #20, #21, #22 | Captains submit, admins approve, manual stats + audit. The review-queue gate goes live. | Sprint 3–4 |
| **M7: Standings + Public League Pages** | #23, #24, #25, #26 | Public hub reflects approved match data. Standings legitimate. | Sprint 4 |
| **M8: CSV/Excel Ops** | #27, #28, #29 | Approved exports + pending exports clearly distinguished. | Sprint 4–5 |
| **M9: ForgeLens OCR Pipeline** | #30, #31, #32 | Staging schema → contract fixtures → live integration. Stretch for S9 launch; can land mid-season. | Sprint 5 |

## Dependency graph

```
#1 ─┐
    ├─ #3
#2  │
    │
#4 ─┐
    ├─ #6 ─┐
#5 ─┤      │
    │      │
#7 ─┘      │
           │
   #8 ─────┼── #9 ── #14 ── #25
   │       │   │            │
   │       │   #10          │
   │       │   #11          │
   │       │                │
   │       └── #12 ─── #13 ─┤
   │                #15     │
   │                        │
   │                #16 ── #17 ── #18
   │
   │              #19 ── #20 ── #21 ── #23 ── #24
   │                          │       │
   │                          #22     │
   │                                  │
   │                          #27 ────┘
   │                          │
   │                  #5 ──── #30 ── #31 ── #32
   │                          │
   │                          #28
   │                          #29
   #26
```

## What must ship before Season 9

- M1 (immediate UX fixes): #1, #2, #3
- M2 (policy/contract docs): #4, #5, #6
- M3 (season/roster): #8, #9, #10
- M4 (schedule): #12, #13, #14
- M5 (match-bound drafts): #16, #17, #18
- M6 (submission + review): #19, #20, #21
- M7 (standings): #23, #24, #25
- M8 (approved-only CSV exports): #27

## What can wait until after S9 launches

- #7, #11 (decision-only docs)
- #15 (stream URL is nice but not blocking)
- #22 (audit log scaffold; easy to add mid-season because it's additive)
- #26 (public players page)
- #28, #29 (pending CSV export and CSV import — both depend on #30)
- #30, #31, #32 (full ForgeLens integration; manual entry covers floor)

## Things not to do

See `docs/review-queue-policy.md` and `docs/forgelens-worker-architecture.md` for full lists. The hard "do nots":

1. Do not rewrite from scratch.
2. Do not import SAL's visual language.
3. Do not migrate to Supabase.
4. Do not auto-approve OCR results — ever.
5. Do not call Gemini directly from FRH.
6. Do not block match submission on ForgeLens availability.
7. Do not require player-to-god mapping during the draft.
8. Do not delete the standalone-draft flow.
9. Do not query staging tables (`ExtractedStatLine`, `OcrExtraction`) from public routes.
10. Do not delete OcrExtraction or ExtractedStatLine rows — status transitions only.
11. Do not allow captains to approve their own submissions.
12. Do not couple ForgeLens deploys to FRH releases.
13. Do not add a "force approve" admin button.
