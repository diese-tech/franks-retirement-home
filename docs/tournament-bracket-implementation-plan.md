# Tournament Bracket — Implementation Plan

Built from `CONTEXT.md` and ADRs 0001–0003, 0006–0009. Structured as fleet-able workstreams: independent agents can run Phase 1 in parallel once Phase 0 lands, because each workstream owns a disjoint set of files. Phase 0 is a hard blocker — everything else imports its schema and engine.

## Phase 0 — Schema + bracket engine (sequential, blocks everything else)

**Files:** `prisma/schema.prisma` (migration), `lib/bracketEngine.js`, `tests/unit/bracketEngine.test.js`

Models (mirroring the `Draft`/`DraftPick` pattern already in the schema):

```prisma
model Tournament {
  id        String   @id @default(cuid())
  name      String
  status    String   @default("draft") // draft | live | completed
  version   Int      @default(0)
  createdAt DateTime @default(now())

  participants Participant[]
  matches      BracketMatch[]
}

model Participant {
  id           String @id @default(cuid())
  tournamentId String
  name         String
  seed         Int    // initial ordering position, determines round-1 placement

  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, seed])
}

model BracketMatch {
  id           String  @id @default(cuid())
  tournamentId String
  round        Int     // 1-based
  position     Int     // 0-based index within the round

  slot1ParticipantId String?
  slot2ParticipantId String?
  winnerParticipantId String?

  nextMatchId     String? // where the winner advances to; null = final match
  nextMatchSlot   Int?    // 1 or 2, which slot in nextMatchId
  loserNextMatchId   String? // unused until double-elim; modeled per ADR-0002
  loserNextMatchSlot Int?

  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, round, position])
}
```

`lib/bracketEngine.js` — pure functions, no Prisma imports, fully unit-testable:

- `generateBracket(participantNames: string[]): { participants, matches }` — participant count must already be a power of 2 (admin pads with literal `"BYE"` entries per ADR-0007; validate and throw if not). Builds round 1 matches pairing consecutive entries, then empty matches for every subsequent round with `nextMatchId`/`nextMatchSlot` computed by standard bracket-tree math.
- `recordWinner(matches, matchId, winnerParticipantId)`: validates the target match is `ready` (both slots filled, no existing winner) and that `winnerParticipantId` equals one of its two slot participant IDs — throws otherwise, so a stale or malformed request can't corrupt the bracket. Returns the updated match list — sets `winnerParticipantId` on the target match, and if `nextMatchId` is set, fills the appropriate slot on that match. Pure/immutable; the caller (API route) persists the diff in a transaction and bumps `Tournament.version`.
- `isTournamentComplete(matches)`: true when the single match with `nextMatchId === null` has a `winnerParticipantId`.
- `matchState(match)`: returns `'empty' | 'ready' | 'decided'` per the `Ready`/`Decided` terms in `CONTEXT.md` — `ready` when both slots are filled and no winner, `decided` when a winner is set.

This is the highest-leverage file to get right and review carefully before anything else builds on it — recommend it ships with thorough unit tests (empty bracket, 2/4/8 participants, byes, a full completion run) before Phase 1 starts.

## Phase 1 — parallel workstreams (fan out after Phase 0 merges)

Each bullet is a self-contained agent task. File boundaries are deliberately disjoint so they can run concurrently without touching the same file (only exception: `components/ui/Nav.js`, called out below).

**B — Admin API** (`app/api/admin/tournaments/route.js`, `app/api/admin/tournaments/[id]/route.js`)
- `POST /api/admin/tournaments` — create (name + ordered participant names) → `bracketEngine.generateBracket` → persist.
- `PATCH /api/admin/tournaments/[id]` — actions: `editParticipant` and `reseed` (both only if every match that participant's slot feeds into still has no winner — per ADR-0008 the lock applies to edits and reseeds alike, not just reseeds), `recordWinner` (calls `bracketEngine.recordWinner`, bumps version, flips `Tournament.status` to `completed` via `isTournamentComplete`), `publish` (draft→live), `reset`/`delete`.
- Every action in this route bumps `Tournament.version` in the same transaction as its mutation — not just `recordWinner`. The SSE stream only re-polls on a version change, so an edit, reseed, publish, or reset that didn't bump it would be invisible to connected viewers until an unrelated later change woke the poll.
- Auth: `resolveAdminAuth(request)` — the site-wide pattern (`lib/resolveAuth.js`), not the Draft system's per-resource `adminKey` (ADR-0008 doesn't call for a separate key scheme; this is internal admin tooling like `/api/admin/*` elsewhere).

**C — Viewer API + SSE** (`app/api/tournaments/route.js`, `app/api/tournaments/[id]/state/route.js`, `app/api/tournaments/[id]/stream/route.js`, `lib/tournamentState.js`)
- List route returns only `live`/`completed` tournaments (never `draft`, per ADR-0003/0006), newest first.
- The `draft` exclusion is enforced in the state builder itself (`lib/tournamentState.js`), not just the list route — both the `state` and `stream` per-ID routes 404 for a `draft` tournament regardless of who requests it, since the ID isn't secret the way a Draft's `adminKey` is.
- `state`/`stream` routes are a direct port of `app/api/drafts/[id]/stream/route.js`'s pattern: poll `Tournament.version` every 1.5s, push full sanitized state (participants + matches with computed `matchState`) on change. No new transport pattern — reuse, don't reinvent (ADR from the interview's Question 4).
- Unlike the Draft stream, the tournament stream terminates once it sends `completed` state: no further polling, per ADR-0003. The client does not auto-reconnect on a clean server-initiated close, so an old bracket's page doesn't leave an open connection polling the database forever.

**D — Admin UI** (`app/admin/tournaments/[id]/page.js`, `app/admin/tournaments/[id]/AdminClient.js`, `app/admin/tournaments/page.js` for the create/list screen)
- Create form (name + textarea/list of participant names, one per line, "BYE" typed like any name).
- Per-match "record winner" controls, participant edit/reseed inline, publish button, reset/delete.
- Reuse `components/ui` (`RetroWindow`, `BrutalButton`, `PixelBadge`, `StatusBadge`) — no new design primitives needed.

**E — Viewer UI + animation** (`app/tournaments/page.js`, `app/tournaments/[id]/page.js`, `app/tournaments/[id]/TournamentClient.js`, `app/tournaments/[id]/BracketTree.js`)
- Consumes the SSE stream from workstream C (agree on the state shape upfront — `{ tournament, participants, matches: [{ id, round, position, slot1, slot2, winner, state }] }` — so D/E can build against a typed mock before C lands, if run in parallel with C rather than strictly after).
- Framer Motion: participants keyed by `participantId` with `layout` prop for the slide; `Decided` matches render the loser with strikethrough; `Ready` matches get a CSS glow (no Framer Motion needed for the glow, just a Tailwind class keyed off `matchState`).
- Initial mount: all participants animate in from the left (`initial`/`animate` variants on first render).

**F — Tests** (`tests/api/tournaments.test.js`, `tests/e2e/tournament.spec.js`)
- API tests: create → record winners through a full small bracket → verify completion, verify reseed rejected once a match is decided, verify draft tournaments are excluded from the public list route.
- One Playwright e2e: admin creates a 4-participant tournament, publishes, records both round-1 winners, records the final — assert the viewer page (opened in a second browser context) reflects each update without a manual reload.

**Nav link** (small, single-line addition to `components/Nav.js` adding a "Tournaments" entry) — cheap enough to just do as part of workstream E rather than its own task.

## Phase 2 — integration pass (sequential, after Phase 1 merges)

- Run the dev server, click through the full happy path plus edge cases: odd participant counts with byes, editing a participant name after publish, attempting to reseed a decided match (should be rejected), a tournament reaching `completed` and staying visible/read-only.
- Confirm `npm run verify:draft` (lint + test + build) is clean.

## Suggested execution

Phase 0 first, alone — it's small and everything else's interfaces depend on its shapes. Once merged, Phase 1's five workstreams (B–F) can be dispatched as parallel agent tasks against fresh branches/worktrees off the post-Phase-0 `main`, then merged in the order B → C → D/E → F to keep each PR's diff reviewable against a stable base.
