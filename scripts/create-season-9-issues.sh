#!/usr/bin/env bash
# Bulk-create the 32 Season 9 backlog issues in the FRH GitHub repo.
#
# Source of truth:
#   docs/season-9-backlog.md
#
# Requirements:
#   - GitHub CLI (gh) installed and authenticated:
#       brew install gh && gh auth login
#   - Repo owner/name set below or via environment variables.
#   - Run from the repo root.
#
# Usage:
#   bash scripts/create-season-9-issues.sh
#
# Idempotency:
#   The script does NOT skip existing issues. If you re-run it you will get
#   duplicates. To re-run safely, close any partially-created issues first.

set -euo pipefail

OWNER="${OWNER:-diese-tech}"
REPO="${REPO:-franks-retirement-home}"
SLUG="$OWNER/$REPO"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not found. Install with 'brew install gh' and run 'gh auth login'." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: gh not authenticated. Run 'gh auth login'." >&2
  exit 1
fi

# ─── Ensure labels exist (idempotent) ──────────────────────────────────────

ensure_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  if ! gh label list --repo "$SLUG" --limit 200 | awk '{print $1}' | grep -qx "$name"; then
    echo "  creating label: $name"
    gh label create "$name" --repo "$SLUG" --color "$color" --description "$description" >/dev/null
  fi
}

echo "Ensuring labels exist on $SLUG..."
ensure_label "ux"        "5DADE2" "User-facing visual or interaction work"
ensure_label "docs"      "0E8A16" "Documentation file or policy doc"
ensure_label "data"      "8E44AD" "Prisma schema or data model change"
ensure_label "page"      "1ABC9C" "New public-facing route"
ensure_label "admin"     "F39C12" "Admin-only UI or workflow"
ensure_label "ops"       "16A085" "League operations: submissions, review, exports"
ensure_label "draft"     "D35400" "Draft engine work"
ensure_label "forgelens" "9B59B6" "ForgeLens worker integration"
ensure_label "nav"       "3498DB" "Navigation / layout shell"
ensure_label "p0"        "B60205" "Must ship for S9 launch; blocking"
ensure_label "p1"        "D93F0B" "Must ship for S9 launch; high priority"
ensure_label "p2"        "FBCA04" "Should ship for S9 launch; can land mid-sprint"
ensure_label "p3"        "C5DEF5" "Stretch / post-S9"

# ─── Create issue helper ────────────────────────────────────────────────────

create_issue() {
  local title="$1"
  local labels="$2"
  local body_file="$3"

  echo "Creating: $title"
  gh issue create \
    --repo "$SLUG" \
    --title "$title" \
    --label "$labels" \
    --body-file "$body_file"
}

# Use a temp directory for issue bodies.
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

write_body() {
  local n="$1"
  local file="$TMPDIR/issue-$n.md"
  cat > "$file"
  echo "$file"
}

# ───────────────────────────────────────────────────────────────────────────
# Chunk 0 — Immediate live draft UX fixes
# ───────────────────────────────────────────────────────────────────────────

BODY=$(write_body 1 <<'EOF'
## Objective

Stop the page from jumping to the bottom of the viewport every time a chat or state update arrives via SSE. The chat panel's internal message list should scroll on its own without dragging the page.

## Scope

- `app/draft/[id]/components/ChatPanel.js` only.
- Replace `bottomRef.current?.scrollIntoView({ behavior: 'smooth' })` with a scoped manual scroll: `messagesRef.current.scrollTop = messagesRef.current.scrollHeight` keyed on the `chats` dependency.

## Out of scope

- RetroWindow component.
- SSE backend, polling cadence, message payloads.
- Chat send/receive logic.
- Any other view.

## Why it matters

Captains lose visual context on every lock-in. Hostile UX during the most-active part of the draft. This is a *separate* bug from the ChatPanel layout fix shipped in PRs #31/#32 — that fix corrected the panel's flex/scroll containment; this fixes the page-jump caused by `scrollIntoView` reaching beyond the panel.

## Acceptance criteria

- After a captain locks in a god, the page viewport does not move.
- The chat panel's internal message list scrolls to the latest message.
- Chat send still works exactly as before.
- `npm run build` passes.

## Validation steps

1. Open a draft as admin in tab A and as captainA in tab B.
2. In tab A, scroll the page so the chat panel is just above the fold.
3. In tab B, lock in a god during pick phase.
4. Confirm tab A's page viewport does not jump; the chat panel's internal scroll updates instead.
5. Repeat for ban phase.

## Dependencies

None.

## Suggested priority

P0.
EOF
)
create_issue "[UX] Fix page-scroll snap on draft lock-in" "ux,p0" "$BODY"

BODY=$(write_body 2 <<'EOF'
## Objective

Match BanView image quality to PickView. Ban grid icons currently render blurry because `GodImage` is rasterized at a fixed 48px and then CSS-stretched to the cell size.

## Scope

- `components/GodImage.js`: add a `fill` mode using `next/image` `fill` + `sizes`, matching the pattern in `GodWideArt`.
- `app/draft/[id]/views/BanView.js`: switch the god grid to use the new fill mode (or pass a `size` matching the rendered cell width).

## Out of scope

- Other views.
- Smitefire URL changes or new image sources.
- Image fallback behavior beyond what already exists.
- PickView (already correct via `GodWideArt`).

## Why it matters

The draft room is the most-watched UI during a league night. Blurry art on the ban grid undermines product credibility precisely when the product is most visible.

## Acceptance criteria

- Ban-phase god grid images are visually crisp at the rendered cell size on desktop and mobile.
- Image error fallback still works.
- `npm run build` passes.

## Validation steps

1. Open a draft in banning phase.
2. Compare ban grid icons to pick grid icons side by side; confirm parity.
3. Resize the viewport from 320px to 1920px; confirm crispness.
4. Force an image load failure (devtools) and confirm the fallback tile renders.

## Dependencies

None.

## Suggested priority

P1.
EOF
)
create_issue "[UX] Fix blurry ban-phase god images" "ux,p1" "$BODY"

BODY=$(write_body 3 <<'EOF'
## Objective

Convert the chat panel from an always-visible 256px-tall block into a docked pill that expands on click. Unread badge on the pill. Click outside or Escape collapses.

## Scope

- `app/draft/[id]/components/ChatPanel.js`
- `app/draft/[id]/DraftClient.js`
- Optional new `ChatDock` wrapper component.
- Keep the retro visual language: RetroWindow chrome with a yellow/orange titlebar.

## Out of scope

- Chat send/receive logic.
- RetroWindow component API changes.
- API routes, SSE, draft state.

## Why it matters

Reclaims vertical space below the draft views, eliminates layout shift on chat updates, matches LoL/Dota conventions players already know.

## Acceptance criteria

- Chat is collapsed by default to a docked pill in a corner.
- Click expands; click-outside or Escape collapses.
- Unread message count appears on the pill.
- Send-on-Enter preserved exactly.
- `npm run build` passes.

## Validation steps

1. Open a draft as admin and captain in two tabs.
2. Send a message from one tab; confirm the other tab's pill shows an unread badge.
3. Click the pill; confirm expansion.
4. Press Escape; confirm collapse.
5. Click outside an expanded panel; confirm collapse.
6. Confirm draft views below do not shift.

## Dependencies

#1 must land first so the scroll-snap fix applies inside the new docked panel.

## Suggested priority

P2.
EOF
)
create_issue "[UX] Collapsible/docked chat panel — LoL-style" "ux,p2" "$BODY"

# ───────────────────────────────────────────────────────────────────────────
# Chunk 1 — Policy and architecture docs
# ───────────────────────────────────────────────────────────────────────────

BODY=$(write_body 4 <<'EOF'
## Objective

Codify human-in-the-loop approval as a binding policy. Pending, OCR-derived, and imported stat-affecting data must never become canonical without explicit admin approval. Public pages, exports, and standings must never read pending tables.

## Scope

- New file: `docs/review-queue-policy.md`.
- Sections: scope of "stat-affecting" data; staging-table-vs-status-flag rationale; who can approve (admin only); pending data invisibility to public queries; rejection retention; supersede semantics; reconciliation expectations.

## Out of scope

- Code, schema changes, UI mockups, auth changes.
- ForgeLens-specific contract details (that's #5).

## Why it matters

Without a written policy, future contributors will bypass the queue, add a "quick admin override," or query staging tables from public routes and corrupt season records. The doc is the reviewer's reference when rejecting future PRs that violate the boundary.

## Acceptance criteria

- File exists at `docs/review-queue-policy.md`.
- All sections populated with prose.
- Linked from `README.md`.
- `npm run build` passes.

## Validation steps

1. Read end to end; confirm substantive content per section.
2. Confirm the README link works in GitHub's rendered preview.

## Dependencies

None.

## Suggested priority

P1.
EOF
)
create_issue "[DOCS] Author docs/review-queue-policy.md" "docs,p1" "$BODY"

BODY=$(write_body 5 <<'EOF'
## Objective

Define ForgeLens as the OCR/stat extraction worker. Establish FRH as the source of truth, Neon as the canonical database, ForgeLens as the Gemini caller, CSV/Excel as the export/fallback layer. Lock down the data contract before any integration work.

## Scope

- New file: `docs/forgelens-worker-architecture.md`.
- Required sections: Purpose; System Responsibilities (FRH, ForgeLens, Gemini, Neon, CSV/Excel, Discord); Data Flow; Job Lifecycle; Review Queue; Data Contract Draft (request, success callback, failure callback); Failure Modes; CSV/Excel Role; Security/Auth (HMAC callback signing, Gemini key isolation, attachment URL TTL); Implementation Phases.

## Out of scope

- Code, schema migrations, real production endpoints.

## Why it matters

Two services iterating without a written contract drift. This doc is the binding interface between FRH and ForgeLens, and the reference for #31 (fixtures) and #32 (integration).

## Acceptance criteria

- File exists at `docs/forgelens-worker-architecture.md`.
- All sections populated.
- Data contract section includes example JSON payloads (request, success callback, failure callback).
- Linked from `README.md`.

## Validation steps

1. Read end to end.
2. Validate example payloads as JSON.
3. Confirm references from `docs/season-9-backlog.md` and `README.md`.

## Dependencies

None.

## Suggested priority

P1.
EOF
)
create_issue "[DOCS] Author docs/forgelens-worker-architecture.md" "docs,forgelens,p1" "$BODY"

BODY=$(write_body 6 <<'EOF'
## Objective

Document the staged Prisma migration sequence (Season → Team → Match → Game → submission/extraction/StatLine → DraftPick relax). Each step has pre-check, command, post-check, and rollback.

## Scope

- New file: `docs/season-9-migration-runbook.md`.
- Per-step content for migrations performed in #8, #12, #18, #19, #21, #30.
- Explicitly mark the destructive step (DraftPick `playerId` nullable + drop unique) as **pre-season only**.
- Capture the rule: mid-season migrations are additive only.

## Out of scope

- Running the migrations.
- Schema design discussion.

## Why it matters

Migrating a live database during a multi-week sprint without a runbook is how production data gets lost. This is the operational playbook for #8, #12, #18, #19, #21, #30.

## Acceptance criteria

- File exists at `docs/season-9-migration-runbook.md`.
- Each migration has: pre-check, command, post-check, rollback.
- Destructive step explicitly flagged.
- "Additive-only mid-season" rule stated as binding policy.

## Validation steps

1. Read end to end.
2. Cross-check each step against the corresponding data issue's scope.
3. Confirm rollback plans don't reference foreign stacks.

## Dependencies

#4 (`docs/review-queue-policy.md`).

## Suggested priority

P1.
EOF
)
create_issue "[DOCS] Author docs/season-9-migration-runbook.md" "docs,data,p1" "$BODY"

BODY=$(write_body 7 <<'EOF'
## Objective

Plan-only doc for sending match results, draft completions, and weekly summaries to a configurable Discord webhook. No implementation in S9.

## Scope

- New file: `docs/discord-webhook-notifications-plan.md`.
- Event list, payload sketch, opt-in config, failure isolation, opt-out path.

## Out of scope

- Implementation.
- Discord OAuth, multi-channel routing.

## Why it matters

Discord is the league's social layer. Plan now so the data shape supports webhook emission; ship after S9.

## Acceptance criteria

- File exists.
- Event types documented with example payloads.
- Failure isolation explicitly stated.

## Validation steps

1. Read end to end.
2. Confirm no implementation work is implied.

## Dependencies

#5 (architecture doc).

## Suggested priority

P3.
EOF
)
create_issue "[DOCS] Author docs/discord-webhook-notifications-plan.md" "docs,ops,p3" "$BODY"

# ───────────────────────────────────────────────────────────────────────────
# Chunk 2 — Season and roster foundation
# ───────────────────────────────────────────────────────────────────────────

BODY=$(write_body 8 <<'EOF'
## Objective

Introduce the season-scoped persistent team primitives. Backfill a Season 9 row. Add an admin tab to manage teams and rosters.

## Scope

- Prisma additions: `Season`, `Team`, `TeamMember`.
- Migration via runbook (#6).
- Seed: insert Season 9 row.
- Admin UI tab: "Teams" with CRUD for teams + member assignment from existing player pool.
- API routes: `/api/seasons`, `/api/teams`, `/api/teams/:id/members` (admin-gated).

## Out of scope

- Match, Game, Draft binding.
- Public Teams page (#9).
- Standings.
- Logos/brand kits beyond an `accentColor` token from FRH palette.

## Why it matters

Every other Season 9 capability hangs off these models. Foundational.

## Acceptance criteria

- Migration runs cleanly on a fresh DB and on a DB with existing draft data.
- Season 9 row exists after seed.
- Admin can create a team, add players, mark a captain, mark a sub.
- `npm run build` and `npm run lint` pass.

## Validation steps

1. Run `npx prisma migrate dev` on a fresh DB.
2. Run on a copy of an existing draft DB; confirm no data loss.
3. Open `/admin` Teams tab; create a test team with 5 players + captain.
4. Confirm `requireAdmin` gates new endpoints.

## Dependencies

#6 (migration runbook).

## Suggested priority

P0.
EOF
)
create_issue "[DATA] Add Season + Team + TeamMember models" "data,admin,p0" "$BODY"

BODY=$(write_body 9 <<'EOF'
## Objective

Add `/teams` and `/teams/[id]` as read-only public pages. Show team name, tag, accent color, roster, captain, and a record placeholder.

## Scope

- New routes: `app/teams/page.js`, `app/teams/[id]/page.js`.
- Use existing RetroWindow / PixelBadge / BrutalButton.
- Filter by current season.

## Out of scope

- Edit flows (admin-only, lives in #8).
- Standings (#24).
- Team brand kits.
- Per-player stat history.

## Why it matters

Players need to see their team's roster. First public read surface for the season model.

## Acceptance criteria

- `/teams` lists current-season teams with links.
- `/teams/[id]` shows roster + captain badge.
- Mobile works at 375px.
- Pages do not query staging tables.
- `npm run build` passes.

## Validation steps

1. Visit `/teams` with seed data.
2. Click into a team; confirm roster.
3. Verify SSR keys are stripped.
4. Test at 375px.

## Dependencies

#8.

## Suggested priority

P1.
EOF
)
create_issue "[PAGE] Public Teams page + Team detail page" "page,ux,p1" "$BODY"

BODY=$(write_body 10 <<'EOF'
## Objective

Add a stat-card row + quick-action grid to the admin landing before the existing tabs. Counts of active matches, pending submissions, current week, total players, total teams, total gods.

## Scope

- `app/admin/AdminClient.js` extension.
- Use RetroWindow + PixelBadge + BrutalButton; no new components.

## Out of scope

- Audit log surface.
- Activity feed.
- Redesign of existing tab content.

## Why it matters

Commissioner orientation. Reflects S9 ops surface immediately on landing.

## Acceptance criteria

- Admin landing shows the stat row above the tab bar.
- Quick-action cards link to most-used flows.
- "Pending submissions" count shows zero before #19 lands and the real number after.
- `npm run build` passes.

## Validation steps

1. Open `/admin` after login.
2. Confirm stat cards render with live counts.
3. Click each quick-action card; confirm correct destination.

## Dependencies

#8.

## Suggested priority

P2.
EOF
)
create_issue "[ADMIN] Admin overview dashboard" "admin,ux,p2" "$BODY"

BODY=$(write_body 11 <<'EOF'
## Objective

Decision/spec issue. Decide whether captains can correct their own roster's stat rows pre-approval, and which fields are editable. Implementation deferred unless explicitly approved.

## Scope

- Decision write-up appended to `docs/review-queue-policy.md`.
- If approved: one-paragraph spec for editable fields.
- If deferred: explicit "S9 = admin-only review" line.

## Out of scope

- Implementation (separate future issue if approved).
- Role models / User table refactor.

## Why it matters

"Captains submit + admins approve" is the simplest legitimate model. Decide deliberately, document the choice, don't drift.

## Acceptance criteria

- Decision documented in `docs/review-queue-policy.md`.
- If "yes": editable fields enumerated.
- If "no": policy doc states S9 is admin-only.

## Validation steps

1. Read the policy doc; confirm decision is explicit.

## Dependencies

#4.

## Suggested priority

P3.
EOF
)
create_issue "[OPS] Define captain-side review boundaries" "ops,docs,p3" "$BODY"

# ───────────────────────────────────────────────────────────────────────────
# Chunk 3 — Match and schedule foundation
# ───────────────────────────────────────────────────────────────────────────

BODY=$(write_body 12 <<'EOF'
## Objective

Introduce scheduled matches and per-match games. Add admin CRUD for schedules including week, status, home/away teams, format (BO1/BO3/BO5), stream URL, and VOD URL.

## Scope

- Prisma additions: `Match`, `Game`.
- Migration via runbook.
- Admin schedule editor: list/create/edit/delete matches; manage games per match.
- API routes: `/api/matches`, `/api/matches/:id`, `/api/matches/:id/games` (admin-gated).
- Status transitions: scheduled → live → completed → postponed.

## Out of scope

- Public schedule page (#13).
- Match-bound draft creation (#16).
- Submissions (#19).
- Twitch API integration.

## Why it matters

Drafts need a parent. Submissions need a target. Without Match/Game, nothing in chunks 4–6 lands.

## Acceptance criteria

- Migration runs cleanly.
- Admin can create a match between two existing teams, schedule it, set BO format, add games.
- Admin can transition match status manually.
- `npm run build` and `npm run lint` pass.

## Validation steps

1. Migration on fresh DB and DB with existing teams.
2. Create a Week 1 match; verify persistence.
3. Add Game 1, 2, 3 to a BO5 match; verify gameNumber.
4. Transition status through all four values.

## Dependencies

#8.

## Suggested priority

P0.
EOF
)
create_issue "[DATA] Add Match + Game models + admin schedule editor" "data,admin,p0" "$BODY"

BODY=$(write_body 13 <<'EOF'
## Objective

Add `/schedule` and `/matches/[id]`. Show week/status filters, both team rosters, scheduled time, stream link if set, match status, and stub placeholders for draft and result data.

## Scope

- New routes: `app/schedule/page.js`, `app/matches/[id]/page.js`.
- Filters: week, status.
- Stream URL renders as a link badge when set.

## Out of scope

- Twitch API live status.
- ICS export.
- Submission UI.
- Draft creation from match (#16).

## Why it matters

Captains and players need to see their week. Schedule is the primary navigation entry point during the season.

## Acceptance criteria

- `/schedule` lists current-season matches grouped or filterable by week.
- Match detail shows both teams, time, status, stream URL.
- Stub placeholders render where data is missing.
- Mobile works at 375px.
- `npm run build` passes.

## Validation steps

1. Seed two teams + a Week 1 match.
2. Visit `/schedule`.
3. Visit `/matches/[id]`.
4. Set a streamUrl in admin; confirm link badge.
5. Test at 375px.

## Dependencies

#12.

## Suggested priority

P1.
EOF
)
create_issue "[PAGE] Public Schedule page + Match detail page" "page,ux,p1" "$BODY"

BODY=$(write_body 14 <<'EOF'
## Objective

Expand nav to include `/`, `/standings`, `/schedule`, `/teams`, `/players`, `/admin`. Add active-page indicator. Add mobile hamburger menu.

## Scope

- `components/Nav.js`.
- Use `usePathname` for active state.
- Mobile menu with retro styling.

## Out of scope

- Auth UI changes.
- Breadcrumbs.
- Search bar.

## Why it matters

Page count is growing fast. Active state and mobile menu are baseline expectations.

## Acceptance criteria

- Desktop nav shows all six links with active styling.
- Mobile hamburger toggles a drawer with same links.
- Links don't 404.
- `npm run build` passes.

## Validation steps

1. Visit each route; confirm active link styling.
2. Resize to 375px; confirm hamburger and drawer.
3. Confirm Escape closes the drawer.

## Dependencies

#9 (Teams pages exist) and #13 (Schedule pages exist) for links to resolve.

## Suggested priority

P1.
EOF
)
create_issue "[NAV] Mature navigation: active states, mobile hamburger, full link set" "nav,ux,p1" "$BODY"

BODY=$(write_body 15 <<'EOF'
## Objective

Render `streamUrl` and `vodUrl` (already on Match from #12) on the homepage and match pages where set. Zero Twitch API integration.

## Scope

- Match detail: link badge with retro styling.
- Homepage live/upcoming sections (when those land in #25): "Watch" link badge.
- Optional: tiny `/watch` redirect to current-week's primary stream URL.

## Out of scope

- Twitch API OAuth.
- Live viewer count.
- Embedded Twitch player.

## Why it matters

Broadcast awareness with zero infra cost.

## Acceptance criteria

- Match with `streamUrl` shows styled link.
- Match without `streamUrl` shows nothing.
- `npm run build` passes.

## Validation steps

1. Set a streamUrl on a match.
2. Visit match page; confirm link works.
3. Clear the streamUrl; confirm nothing renders.

## Dependencies

#12.

## Suggested priority

P2.
EOF
)
create_issue "[OPS] Stream URL field on matches; minimal Watch awareness" "ops,ux,p2" "$BODY"

# ───────────────────────────────────────────────────────────────────────────
# Chunk 4 — Match-bound drafts
# ───────────────────────────────────────────────────────────────────────────

BODY=$(write_body 16 <<'EOF'
## Objective

Add nullable `Draft.gameId`. From the Match detail page, "Open Draft for Game N" creates a Draft tied to that Game and prepopulates Team A/B from the Match's team rosters. The standalone draft flow remains intact.

## Scope

- Schema: `Draft.gameId` nullable FK to `Game`.
- Migration via runbook.
- Admin flow: button on `/matches/[id]` per game.
- Auto-population: pull `TeamMember` rows for both teams; create `DraftPick` rows for the 5 starters per side.
- Captain keys generated as today.

## Out of scope

- Team-level pick refactor (#18).
- Vault scope shift (#17).
- Submissions (#19, #20).

## Why it matters

Removes manual roster assembly. Eliminates wrong-team bugs across a 16-team season.

## Acceptance criteria

- A draft created from a Game has `gameId` set and Team A/B populated from team rosters.
- Standalone drafts still work with `gameId = null`.
- Captain keys generated and shareable.
- `npm run build` passes.

## Validation steps

1. Create a Match with two teams.
2. Open Match detail; click "Open Draft for Game 1."
3. Confirm draft room loads with both rosters prefilled.
4. Confirm `Draft.gameId` is set.
5. Create a standalone draft; confirm it works.

## Dependencies

#12.

## Suggested priority

P1.
EOF
)
create_issue "[DRAFT] Bind drafts to a Game; prepopulate from team rosters" "draft,data,p1" "$BODY"

BODY=$(write_body 17 <<'EOF'
## Objective

For match-bound BO3/BO5 drafts, the god vault (`usedGodIds`) spans all Games of the same Match. Standalone drafts continue per-Draft.

## Scope

- Update vault read logic to aggregate across `Game.matchId` siblings when Draft has `gameId`.
- Update vault write logic stays on the active Draft.
- Standalone draft path unchanged.

## Out of scope

- Schema changes (no new columns; aggregation is query-side).
- UI labeling beyond existing "Vaulted" treatment.

## Why it matters

A real BO3 should not let a god picked in Game 1 reappear in Game 2. League rule, not optional.

## Acceptance criteria

- A god picked in Game 1 of a match-bound BO3 shows as Vaulted in Game 2's draft room.
- Same god in a standalone draft continues to vault per-Draft only.
- `npm run build` passes.

## Validation steps

1. Create BO3 match; pick Hercules in Game 1.
2. Open Game 2 draft; confirm Hercules is Vaulted.
3. In a separate standalone draft, pick Hercules; confirm not vaulted in another standalone draft.

## Dependencies

#16.

## Suggested priority

P1.
EOF
)
create_issue "[DRAFT] Shift vault scope from per-Draft to per-Match" "draft,p1" "$BODY"

BODY=$(write_body 18 <<'EOF'
## Objective

Make `DraftPick.playerId` nullable. Drop or condition the `@@unique([draftId, playerId])` constraint. Update PickView UI to record picks at team level. Add a post-draft Lineup Confirmation view where captains assign players to gods.

## Scope

- Schema: `DraftPick.playerId` nullable; constraint dropped/conditional.
- PickView UI: pick rows show team + god, no player name during draft.
- New "Lineup Confirmation" UI: captain assigns 5 players to 5 gods; updates `DraftPick.playerId`.
- Backwards-compatible with existing player-locked picks.

## Out of scope

- OCR-driven assignment (#32).
- Submission flow (#19).
- Auto-detection from screenshots.

## Why it matters

Highest-risk piece of S9 work. Touches the most-tested code path. Reflects how Smite drafting actually happens. Required to enable OCR-inferred mappings later.

## Acceptance criteria

- Migration runs cleanly; existing picks preserved.
- New picks can be recorded with `playerId` null.
- PickView shows team-level rows.
- Lineup Confirmation reachable post-draft; updates DB.
- `npm run build`, `npm run lint`, full BO1 dry-run pass.

## Validation steps

1. Run migration on prod-like DB copy.
2. Run a full standalone draft.
3. Run a full match-bound draft.
4. Use Lineup Confirmation; verify DB updates.
5. Skip Lineup Confirmation; verify draft still completes.

## Dependencies

#16, #17.

## Suggested priority

P1. **High risk.**
EOF
)
create_issue "[DRAFT] Refactor DraftPick to team-level; add Lineup Confirmation view" "draft,data,p1" "$BODY"

# ───────────────────────────────────────────────────────────────────────────
# Chunk 5 — Match submission and review queue
# ───────────────────────────────────────────────────────────────────────────

BODY=$(write_body 19 <<'EOF'
## Objective

Captains submit match results: reported winner, optional notes, and one or more screenshot attachments. Stored in FRH; no OCR yet.

## Scope

- Schema: `MatchSubmission`, `SubmissionAttachment`.
- Migration via runbook.
- Captain UI: submission form on `/matches/[id]`.
- Screenshot upload to Vercel Blob (or comparable; helper-isolated).
- API routes: `/api/matches/:id/submissions` (captain-key gated), `/api/submissions/:id` (admin or owning captain).

## Out of scope

- Review approval workflow (#20).
- OCR job creation (#32).
- StatLine (#21).

## Why it matters

Without this, the league cannot record any results in FRH at all.

## Acceptance criteria

- Captain submits winner + notes + screenshots.
- Screenshots upload; URLs stored.
- Submission row has `status = pending`.
- `npm run build` passes.

## Validation steps

1. Captain opens match detail post-game.
2. Submit winner with two screenshots.
3. Verify rows in MatchSubmission and SubmissionAttachment.
4. Verify URLs resolve.
5. Submit without auth; confirm 401.

## Dependencies

#12.

## Suggested priority

P0.
EOF
)
create_issue "[OPS] MatchSubmission + SubmissionAttachment + screenshot upload" "ops,data,p0" "$BODY"

BODY=$(write_body 20 <<'EOF'
## Objective

Admin reviews pending submissions; approves or rejects; optionally edits fields; triggers standings recompute on approval.

## Scope

- Admin tab "Review Queue" listing pending submissions.
- Per-submission detail view with attachments, reported winner, notes.
- Actions: approve (sets `Game.winnerTeamId`, transitions status, recomputes standings), reject (with reason), supersede.
- Status: pending → in_review → approved | rejected | superseded.

## Out of scope

- OCR ingestion (#32).
- Captain self-review (decision in #11).
- StatLine entry (#21).

## Why it matters

The review queue is the canonical correctness gate for the entire league.

## Acceptance criteria

- Admin sees all pending submissions in a queue.
- Approve writes `Game.winnerTeamId` and recomputes standings.
- Reject preserves with `status = rejected` and reason.
- Superseded preserved for audit.
- Pending submissions never affect standings or public match pages.
- `npm run build` passes.

## Validation steps

1. Captain submits via #19.
2. Admin opens Review Queue; sees pending submission.
3. Approve; confirm `Game.winnerTeamId` and standings update.
4. Reject another; confirm `status = rejected` with reason.
5. Confirm superseded persists.

## Dependencies

#4, #19.

## Suggested priority

P0.
EOF
)
create_issue "[OPS] Review queue UI + manual approval flow" "ops,admin,p0" "$BODY"

BODY=$(write_body 21 <<'EOF'
## Objective

Add canonical approved StatLine rows. Admin manual stat entry form so the league records per-game player stats even without ForgeLens.

## Scope

- Schema: `StatLine`. Migration via runbook.
- Admin UI: per-game stat entry form integrated into Review Queue submission detail view.
- Approval of submission with manual stats writes StatLine rows alongside `Game.winnerTeamId` update.

## Out of scope

- ExtractedStatLine staging (#30).
- OCR (#32).
- Public stat pages (post-S9).

## Why it matters

OCR is a stretch goal. Manual entry is the floor. Without it, the league has zero stat history for S9 if ForgeLens never ships.

## Acceptance criteria

- Admin enters per-player stats during review.
- On approval, StatLine rows created with `source = 'manual'`.
- StatLine visible on future match/admin pages.
- `npm run build` passes.

## Validation steps

1. Approve a submission with stats for 10 players.
2. Verify 10 StatLine rows with `source = 'manual'`.
3. Confirm pending submissions never have StatLine rows.

## Dependencies

#20.

## Suggested priority

P0.
EOF
)
create_issue "[DATA] StatLine model + manual stat entry form" "data,ops,admin,p0" "$BODY"

BODY=$(write_body 22 <<'EOF'
## Objective

Add a lightweight `AuditLog` table and a helper to capture every status transition on `MatchSubmission`, `OcrExtraction`, `ExtractedStatLine`, and `StatLine`. No reader UI in S9.

## Scope

- Schema: `AuditLog` (entityType, entityId, action, actor, fromStatus, toStatus, payload jsonb, createdAt).
- Helper: `lib/audit.js::recordTransition()`.
- No UI.

## Out of scope

- Reader UI.
- Per-row diffing.
- Retention policy.

## Why it matters

When commissioners ask "how did this result get changed?" three weeks in, capture-from-day-one is the difference between answering and a forensic problem.

## Acceptance criteria

- AuditLog rows written on approval, rejection, supersede transitions for the four entity types.
- Audit writes never block primary actions (best-effort with error log).
- `npm run build` passes.

## Validation steps

1. Approve a submission; confirm audit row.
2. Reject; confirm row.
3. Supersede; confirm row.
4. Confirm payload contains relevant context.

## Dependencies

#20.

## Suggested priority

P2.
EOF
)
create_issue "[OPS] Audit log scaffold — capture now, surface later" "ops,data,p2" "$BODY"

# ───────────────────────────────────────────────────────────────────────────
# Chunk 6 — Standings and public league ops pages
# ───────────────────────────────────────────────────────────────────────────

BODY=$(write_body 23 <<'EOF'
## Objective

Centralize standings calculation in `lib/standings.js`. Reads only approved `Game.winnerTeamId` rows. Caches briefly. Called from approval, rejection-of-previously-approved, manual invalidation, and admin "recompute" button.

## Scope

- New `lib/standings.js` exporting `computeSeasonStandings(seasonId)`.
- Returns season-scoped W/L/win-pct rows per team.
- Cache for 30s.
- Pure read of approved data.

## Out of scope

- Tiebreakers beyond W/L.
- Head-to-head splits.
- Materialized standings table.

## Why it matters

Standings calculation scattered across approval handlers will drift. Centralize once.

## Acceptance criteria

- Approving recomputes standings.
- Rejecting a previously-approved submission recomputes.
- Function never queries staging tables.
- `npm run build` passes.

## Validation steps

1. Approve two matches with different winners; confirm 1-0 / 0-1.
2. Reject a previously-approved; confirm standings update.
3. Confirm cache TTL prevents recompute storms.

## Dependencies

#20.

## Suggested priority

P1.
EOF
)
create_issue "[OPS] Standings recompute service" "ops,data,p1" "$BODY"

BODY=$(write_body 24 <<'EOF'
## Objective

Add `/standings` (public) plus admin "Recompute Standings" button. W/L minimum.

## Scope

- New route: `app/standings/page.js`.
- Renders standings via `lib/standings.js` from #23.
- Admin button visible only to authenticated admins.

## Out of scope

- Tiebreakers.
- Per-division splits if FRH skips fixed divisions.

## Why it matters

League legitimacy. Most-checked page during a season.

## Acceptance criteria

- `/standings` renders for unauthenticated users.
- Reflects approved matches only.
- Admin recompute works; invisible to non-admins.
- Mobile works at 375px.
- `npm run build` passes.

## Validation steps

1. Approve matches; visit `/standings`; confirm rows.
2. Verify pending submissions don't affect standings.
3. Click admin recompute; confirm no errors.

## Dependencies

#23.

## Suggested priority

P1.
EOF
)
create_issue "[PAGE] Standings page — public + admin recompute" "page,admin,p1" "$BODY"

BODY=$(write_body 25 <<'EOF'
## Objective

Replace the tabbed homepage with stacked sections: live matches → upcoming → recent → standings preview → teams/Discord. Preserve FRH retro identity.

## Scope

- `app/HomepageClient.js`, `app/page.js`.
- Compose from existing primitives.
- Keep retro voice in copy.

## Out of scope

- New global components.
- Twitch API integration.
- Ticker bar.

## Why it matters

First impression of the platform. Current homepage doesn't reflect League Ops.

## Acceptance criteria

- Homepage shows live → upcoming → recent → standings preview → teams/Discord.
- Empty states handled with retro voice.
- Mobile works at 375px.
- `npm run build` passes.

## Validation steps

1. Empty state with no matches.
2. Upcoming match appears in upcoming section.
3. Live match pins to top.
4. Completed match in recent.
5. Standings preview shows top 3.

## Dependencies

#13, #24.

## Suggested priority

P1.
EOF
)
create_issue "[UX] Homepage redesign for League Ops" "ux,page,p1" "$BODY"

BODY=$(write_body 26 <<'EOF'
## Objective

Add `/players` with filters by team, role, and season. Stretch goal for S9.

## Scope

- New route: `app/players/page.js`.
- Read-only list with filters.
- Respects season scope (default = current).

## Out of scope

- Player detail/profile pages.
- Per-player stat history.

## Why it matters

Captains and players want to browse the pool. Not blocking S9.

## Acceptance criteria

- `/players` renders.
- Filters work.
- Mobile works.
- `npm run build` passes.

## Validation steps

1. Visit `/players`.
2. Filter by team and role.
3. Test at 375px.

## Dependencies

#8, #9.

## Suggested priority

P3.
EOF
)
create_issue "[PAGE] Public Players page" "page,p3" "$BODY"

# ───────────────────────────────────────────────────────────────────────────
# Chunk 7 — CSV / Excel operations
# ───────────────────────────────────────────────────────────────────────────

BODY=$(write_body 27 <<'EOF'
## Objective

Export approved canonical league data as CSV. Filenames clearly indicate "approved" and date. No pending data leaks.

## Scope

- API routes: `/api/exports/standings.csv`, `/api/exports/schedule.csv`, `/api/exports/roster.csv`, `/api/exports/stats.csv`.
- Admin UI buttons; some publicly exposed (standings, schedule).
- Filename convention: `frh-s9-{type}-YYYY-MM-DD.csv`.

## Out of scope

- Excel `.xlsx`.
- ICS export.
- Pending or raw exports (#28).

## Why it matters

Spreadsheets are commissioners' trusted backup. Approved-only exports protect public data integrity.

## Acceptance criteria

- Each route returns valid CSV with header row.
- Pending data structurally absent.
- Filenames follow convention.
- `npm run build` passes.

## Validation steps

1. Hit each export endpoint; confirm download.
2. Open in spreadsheet; confirm sensible columns.
3. Confirm no pending data appears.

## Dependencies

#21, #24.

## Suggested priority

P1.
EOF
)
create_issue "[OPS] CSV exports — approved-only standings, schedule, roster, season stats" "ops,p1" "$BODY"

BODY=$(write_body 28 <<'EOF'
## Objective

Allow admins to export pending/extracted rows for reconciliation against ForgeLens raw output. Filenames and columns visibly marked "PENDING / NOT OFFICIAL."

## Scope

- Admin-only route: `/api/exports/pending-ocr.csv`.
- Filename: `frh-s9-pending-ocr-YYYY-MM-DD.csv`.
- First column: `STATUS` containing `PENDING`.
- Banner in admin UI: "This export contains unapproved data."

## Out of scope

- Public exposure.
- Integration with public exports.

## Why it matters

Reconciliation between FRH staging tables and ForgeLens raw output catches parser regressions early.

## Acceptance criteria

- Endpoint requires admin auth.
- Filename and STATUS column reflect pending state.
- `npm run build` passes.

## Validation steps

1. Without auth: 401.
2. With admin auth: download.
3. Confirm filename, STATUS column, admin-UI banner.

## Dependencies

#30 (staging tables exist).

## Suggested priority

P2.
EOF
)
create_issue "[OPS] Pending OCR CSV export — admin-only, marked PENDING" "ops,admin,forgelens,p2" "$BODY"

BODY=$(write_body 29 <<'EOF'
## Objective

Admin can paste/upload a ForgeLens-formatted CSV. Each row becomes an `ExtractedStatLine` with `source = 'manual_csv'`. Standard review queue applies. No auto-approval.

## Scope

- Admin UI: paste/upload form on Review Queue.
- API route: `/api/imports/stats` (admin-gated).
- Validation: row schema, IGN strings, god IDs.
- Per-row error messages on malformed rows.

## Out of scope

- Public import.
- Auto-approval.

## Why it matters

Operational resilience when ForgeLens is unavailable.

## Acceptance criteria

- Admin pastes CSV; rows enter as `ExtractedStatLine` pending.
- Malformed rows return clear errors; no partial commit.
- `npm run build` passes.

## Validation steps

1. Paste a known-good ForgeLens CSV; confirm staging rows.
2. Paste malformed; confirm errors.
3. Confirm staging rows never appear in standings or public exports.

## Dependencies

#30.

## Suggested priority

P2.
EOF
)
create_issue "[OPS] CSV import path for stats — fallback when ForgeLens is down" "ops,admin,forgelens,p2" "$BODY"

# ───────────────────────────────────────────────────────────────────────────
# Chunk 8 — ForgeLens / OCR pipeline
# ───────────────────────────────────────────────────────────────────────────

BODY=$(write_body 30 <<'EOF'
## Objective

Add staging tables for OCR/imported pending stat data and `PlayerAlias` for IGN matching. Schema only or with a minimal read-only admin view.

## Scope

- Prisma additions: `OcrExtraction`, `ExtractedStatLine`, `PlayerAlias`.
- Migration via runbook.
- Optional: read-only admin view listing OcrExtraction rows.

## Out of scope

- ForgeLens job creation, callbacks (#32).
- Approval flows specific to OCR.
- Auto-promotion of staging rows.

## Why it matters

Splits "schema landing" from "wire integration" so each can be reviewed and shipped independently.

## Acceptance criteria

- Migration runs cleanly.
- `npm run build` and `npm run lint` pass.
- Public routes and `lib/standings.js` cannot read these tables (verified by grep).

## Validation steps

1. Migration on fresh DB and DB with existing data.
2. Insert fake OcrExtraction via prisma studio.
3. Confirm it does not appear in `/standings` or any public CSV export.

## Dependencies

#5, #21.

## Suggested priority

P2.
EOF
)
create_issue "[DATA] OcrExtraction + ExtractedStatLine schema + PlayerAlias" "data,forgelens,p2" "$BODY"

BODY=$(write_body 31 <<'EOF'
## Objective

Provide a stable set of example callback payloads (success, low-confidence, partial, failure, malformed) that FRH and ForgeLens both test against. Lives in the FRH repo as the contract source of truth.

## Scope

- `tests/fixtures/forgelens/` directory with JSON files matching the contract from `docs/forgelens-worker-architecture.md`.
- Subset of FRH-side tests that load fixtures and exercise the callback handler.

## Out of scope

- Real ForgeLens integration.
- Real Gemini calls.
- Network testing.

## Why it matters

Two services iterating against a written contract still drift. Fixtures are the executable form. Lets ForgeLens authors verify locally without spinning up FRH.

## Acceptance criteria

- Fixtures exist for: success, low-confidence, partial, failure, malformed.
- Each fixture is valid JSON conforming to #5's contract.
- Fixtures referenced from the architecture doc.
- `npm run build` passes.

## Validation steps

1. Load each fixture in Node; parse as JSON.
2. Confirm field coverage matches contract.

## Dependencies

#5, #30.

## Suggested priority

P2.
EOF
)
create_issue "[FORGELENS] Author ForgeLens callback contract test fixtures" "forgelens,docs,p2" "$BODY"

BODY=$(write_body 32 <<'EOF'
## Objective

Wire the hybrid OCR architecture: FRH creates OCR jobs, posts to ForgeLens, receives signed callbacks, stores `OcrExtraction` and `ExtractedStatLine` rows in the review queue. Approval (admin-only) promotes to canonical StatLine and recomputes standings.

## Scope

- Job creation on screenshot upload: FRH POSTs to ForgeLens with the contract from #5.
- Callback receiver at `/api/forgelens/callback` with HMAC verification.
- Retry logic on failures (exponential backoff, max retries).
- Status transitions: queued → processing → completed | failed | needs_review → approved | rejected | superseded.
- Admin Review Queue extension: per-extraction view with raw + parsed output, edit fields, approve to promote rows to canonical StatLine.

## Out of scope

- Auto-approval (never).
- Public OCR dashboards.
- IGN auto-matching beyond exact string match (follow-on enhancement).

## Why it matters

Stat ingestion at scale isn't viable without automation. Largest single piece of S9 work; also stretch — manual entry (#21) is the fallback if this slips.

## Acceptance criteria

- Uploaded screenshot triggers a ForgeLens job.
- Successful callback creates OcrExtraction and ExtractedStatLine rows.
- Failure callback marks extraction failed; manual entry remains available.
- Admin reviews and approves; on approval, StatLine rows written.
- HMAC-signed callbacks reject unsigned/invalid requests.
- `npm run build` passes.

## Validation steps

1. Run against ForgeLens staging or a mock returning fixtures from #31.
2. Verify success path: extraction → review → approve → StatLine.
3. Verify failure path: failed extraction does not block manual entry.
4. Verify HMAC: forged callback returns 401.
5. Approve a low-confidence extraction; confirm admin saw the warning.

## Dependencies

#30, #31.

## Suggested priority

P2 for S9 launch; P1 mid-season.
EOF
)
create_issue "[FORGELENS] Hybrid OCR integration v1 — jobs, callbacks, signed auth" "forgelens,ops,p2" "$BODY"

echo
echo "✅ Created all 32 Season 9 backlog issues on $SLUG"
