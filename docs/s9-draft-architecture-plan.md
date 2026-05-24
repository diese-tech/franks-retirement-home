# FRH-Native Draft Architecture
## SAL Audit Reference — Implementation Plan

---

# Executive Summary

- FRH needs two distinct draft systems: the existing **God Draft** (per-game pick/ban of gods, already running) and a new **Player Draft** (per-season snake draft of players to populate team rosters). These must remain separate data models with no shared tables or flows.
- The build strategy is additive-only: every new model is added alongside existing ones. `Draft.gameId` is nullable so standalone drafts survive untouched. `PlayerDraft` is a wholly new model chain. No existing production data is mutated until explicitly scheduled.
- SAL's pure logic functions in `src/lib/god-draft-format.ts` and `src/lib/god-draft-rules.ts` are conceptually portable; FRH should implement equivalent plain-JS modules in `lib/` rather than copying TypeScript files that carry Supabase and SAL-specific dependencies.
- Supabase Realtime and RLS must not enter FRH. FRH's SSE polling pattern (`Draft.version` optimistic lock on Neon PostgreSQL) is sufficient — Neon is fully compatible with this approach because SSE polling uses ordinary `SELECT` queries, not `LISTEN/NOTIFY`.
- FRH's standalone draft flow is preserved as the permanent scrim/testing fallback and must pass all existing tests before and after every new migration.
- Season 9 introduces two divisions (**Hospice** and **Rehabilitation**). Divisions are first-class entities. Every season will use a snake draft; player import via CSV is the standard intake path.

---

# SAL Draft System Map

| SAL Table | Purpose | FRH Equivalent | Status |
|---|---|---|---|
| `draft_rooms` | Player snake draft session, one per season+division | `PlayerDraft` (new) | Not yet implemented |
| `draft_picks` (player) | Records which org picked which player and at what position | `PlayerDraftPick` (new) | Not yet implemented |
| `captain_tokens` | One-time DB tokens for captain auth exchange | Not needed | FRH uses URL key tokens already in `Draft.captainAKey/captainBKey`; same pattern extends to `PlayerDraft` |
| `captain_shortlists` | Per-org ordered wishlist during player draft | Not planned for S9 | Optional stretch feature |
| `god_draft_sessions` | God pick/ban session per game | `Draft` (exists) | Exists; needs `gameId` FK added |
| `god_picks` | Finalized picks written atomically at completion | `DraftPick` (exists) | Exists; playerId needs to become nullable (issue #51) |
| `god_bans` | Finalized bans written atomically at completion | `DraftBan` (exists) | Exists |
| `draft_chat_messages` | In-draft chat, multi-channel | `DraftChat` (exists) | Exists |
| `seasons` (implicit in SAL league data) | Season scoping | `Season` (new, issue #41) | Not yet implemented |
| SAL `orgs` / `teams` | Team/org entities | `Team` + `Org` (display) + `TeamMember` (new, issue #41) | Not yet implemented |
| SAL `matches` | Match scheduling | `Match` (new, issue #45) | Not yet implemented |
| SAL `god_draft_sessions.game_number` | Game-within-match number | `Game.gameNumber` (new, issue #45) | Not yet implemented |
| SAL divisions (gaia/solar/lunar) | Tiered divisions | `Division` (new) — Hospice / Rehabilitation, same-division-only drafting | Not yet implemented |

---

# Player Draft Flow in SAL

### Full Step-by-Step

**Step 1 — Admin creates room.** `createDraftRoom()` in `src/lib/draft-data.ts` inserts a `draft_rooms` row with `status = "pending"`, `season_id`, `division_id`, `rounds`, `pickTimerSeconds`. The `base_order` array (org IDs in round-1 order) is left empty and set separately.

**Step 2 — Admin sets base order.** `updateDraftRoom(id, { baseOrder: [...orgIds] })`. This is a separate action; the room is still `pending`. DB-dependent.

**Step 3 — Admin starts the draft.** Sets `status = "active"`, `pickStartedAt = now()`, `currentPickIndex = 0`, `startedAt = now()`. DB-dependent.

**Step 4 — Draft state is computed on read.** `buildDraftState(draftRoomId)` in `src/lib/draft-data.ts`:
- Fetches `draft_rooms` row and all `draft_picks`.
- Calls `buildPickSequence(baseOrder, rounds)` — **pure function**, no deps, see `src/types/draft.ts`.
- Computes `currentOrgId = pickSequence[currentPickIndex]` when active.
- Computes `secondsRemaining` from `pickStartedAt`.
- DB-dependent except for `buildPickSequence`.

**Step 5 — Captain polls for state.** `/api/draft/[id]` every 3 seconds. No Supabase Realtime. Captain authenticates via HMAC-signed cookie carrying `"draftRoomId|orgId"` (consumed one-time token → cookie exchange).

**Step 6 — Active org's captain submits a pick.** `recordPick(draftRoomId, pickNumber, orgId, playerId)` inserts a `draft_picks` row, then `updateDraftRoom` advances `currentPickIndex` and resets `pickStartedAt`. DB-dependent.

**Step 7 — Turn advances via snake order.** `buildPickSequence` determines the next `orgId`. Even rounds: base order. Odd rounds: reversed. Pure function.

**Step 8 — Draft completes.** When `currentPickIndex >= totalPicks`, admin marks `status = "complete"`, sets `completedAt`. DB-dependent.

**Step 9 — Team rosters are created.** SAL does NOT do this automatically. FRH must add a completion step that reads all `PlayerDraftPick` rows and creates `TeamMember` rows in a transaction.

**What FRH must add that SAL omits:**
- `TeamMember` creation on draft completion (transactional).
- Same-division-only pick validation (SAL has cross-division tier; FRH has strict same-division rule).
- Draft slot trade support (FRH captains can bilaterally agree to swap pick positions mid-draft).
- CSV player import to populate the eligible player pool before the draft.

---

# God Draft Flow in SAL

### Full Step-by-Step

**Step 1 — Session created.** Admin (or automated trigger) inserts a `god_draft_sessions` row with `status = "pending"`, bound to `match_id` and `game_number`.

**Step 2 — Lobby (bilateral ready).** Each captain marks themselves ready. When both are ready, `transitionReady` (pure logic in `src/lib/god-draft-rules.ts`) sets `status = "banning"` and initializes the first turn cursor.

**Step 3 — Banning phase.** Format: 6 bans, sequence `A B A B A B`. Each submission calls `applyDraftSelection` (pure logic) to advance the cursor.

**Step 4 — Picking phase (two sub-phases).** 10 picks total: `A B B A A B` then `B A A B`.

**Step 5 — Draft completes.** When `getNextDraftTurn` returns null, an atomic write finalizes all picks/bans and sets `status = "complete"`. FRH equivalent: Prisma `$transaction`.

**Binding to Match.gameNumber.** Vault aggregates `DraftPick.godId` from sibling Games of the same Match where `gameNumber < current`.

**Bilateral reset flow.** First captain requests → stored. Second captain confirms → `resetLobbyPatch()` fires. Admin can reset unilaterally.

**Timeout rules.**
- Ban timeout: skip ban, draft advances.
- Pick timeout: full reset to lobby.

**Realtime.** SAL uses Supabase `postgres_changes`. FRH uses SSE with `Draft.version` polling at 1.5s. Neon is fully compatible.

**Auth.** Captain keys auto-provisioned at match scheduling. One key per team covers all games in a BO series.

**Sub handling.** During lobby, a captain swaps a starter for a `TeamMember` where `isSub = true` via the existing swap mechanism.

---

# Reusable Logic Patterns

| SAL Source | Function(s) | FRH translation | Portability |
|---|---|---|---|
| `src/types/draft.ts` | `buildPickSequence(baseOrder, rounds)` | `lib/playerDraftOrder.js` | Can copy logic verbatim; strip TS types |
| `src/lib/god-draft-format.ts` | `getDraftTurn`, `getFirstDraftTurn`, `getNextDraftTurn` | `lib/godDraftFormat.js` (extract from existing inline logic) | Conceptually translate |
| `src/lib/god-draft-rules.ts` | `applyDraftSelection` | `lib/godDraftRules.js` | Conceptually translate |
| `src/lib/god-draft-rules.ts` | `applyTimeout` | `lib/godDraftRules.js` | Conceptually translate |
| `src/lib/god-draft-rules.ts` | `applyResetRequest` | `lib/godDraftRules.js` — also for PlayerDraft slot trades | Conceptually translate |
| `src/lib/god-draft-rules.ts` | `validateUniqueDraftState` | `lib/godDraftRules.js` | Can copy logic verbatim |
| `src/lib/god-draft-rules.ts` | `getVaultedGodIdsFromPicks` | `lib/usedGodIds.js::getMatchVaultedGodIds` | Conceptually translate; DB query replaces in-memory filter |
| `src/lib/god-draft-rules.ts` | `canRoleSubmitDraftAction` | Extend `lib/draftAuth.js` | Can copy logic verbatim |
| `src/lib/draft-data.ts` | `buildDraftState` (player variant) | `lib/playerDraftState.js::buildPlayerDraftState` | Conceptually translate |

**Key distinction:** `src/lib/god-draft-format.ts` and `src/lib/god-draft-rules.ts` are genuinely pure (no I/O) — these are the most trustworthy reference points. All of `src/lib/god-draft-data.ts` and `src/lib/draft-data.ts` is I/O-bound Supabase code — use only as a reference for query shapes.

---

# SAL-Specific Assumptions to Avoid

**1. Cross-division tier eligibility → FRH same-division rule.**
FRH Season 9 has two flat divisions: Hospice and Rehabilitation. Pick validation rule: `player.division === playerDraft.division.name` (equality, not tier comparison).

**2. Supabase Realtime.** Do not introduce a Supabase client. FRH's SSE + `Draft.version` is correct and Neon-compatible.

**3. RLS as auth layer.** FRH uses app-level auth in `lib/draftAuth.js` and `lib/adminSession.js`.

**4. One-draft-per-season+division constraint.** This IS valid for FRH — add `@@unique([seasonId, divisionId])` to `PlayerDraft`.

**5. Hard-seeded god fallback list.** FRH maintains all gods in the `God` table from smitebrain.com. Use `prisma.god.findMany()` and surface an error on DB failure.

**6. Org branding in draft logic.** `Org` is a display entity only. Captain identity comes from `TeamMember.isCaptain` + URL key token.

**7. Manual per-session captain key distribution.** FRH auto-provisions captain keys at match scheduling (`Match.homeTeamCaptainKey`, `Match.awayTeamCaptainKey`). One key per team covers all games in a BO series.

**8. Supabase RPC for atomic completion.** Use Prisma `$transaction()` instead.

**9. Captain shortlists.** P3 stretch feature — not required for S9.

---

# FRH-Native Draft Architecture

```
Season
 ├── Division (Hospice | Rehabilitation)
 │    └── Team (many per division per season)
 │         ├── Org (display entity — logo, gradient, colors)
 │         └── TeamMember (many per team; FK to Player)
 │
 ├── Match (many per season; scoped to a division)
 │    ├── homeTeamCaptainKey  ← auto-generated at scheduling
 │    ├── awayTeamCaptainKey  ← auto-generated at scheduling
 │    └── Game (many per match; gameNumber 1-based)
 │         └── Draft [gameId FK, nullable] (auto-provisioned per game when match is scheduled)
 │                  ├── DraftPick (pre-seeded from TeamMember + sub-swap in lobby)
 │                  ├── DraftBan
 │                  └── DraftChat
 │
 └── PlayerDraft (one per season per division; @@unique([seasonId, divisionId]))
      ├── baseOrder  JSON  ← original approved order (immutable, audit trail)
      ├── currentOrder JSON ← live order; modified by admin-approved slot trades
      └── PlayerDraftPick (one per snake pick slot; references Player)
           └── [on completion] → creates TeamMember rows

Standalone Draft [gameId = null]  ← always available for scrims/testing
 ├── DraftPick
 ├── DraftBan
 └── DraftChat
```

**Vault scoping:**
- Standalone `Draft` (`gameId = null`): vault = `Draft.usedGodIds` (unchanged)
- Match-bound `Draft` (`gameId != null`): vault = query-time aggregation of `DraftPick.godId` from sibling Games where `gameNumber < current`

---

# Proposed PlayerDraft Model

```prisma
model Division {
  id        String   @id @default(cuid())
  seasonId  String
  name      String   // "Hospice" | "Rehabilitation"
  tier      Int      // display/sort only — NOT a pick eligibility gate
  createdAt DateTime @default(now())

  season      Season       @relation(fields: [seasonId], references: [id])
  teams       Team[]
  playerDraft PlayerDraft?
  matches     Match[]

  @@unique([seasonId, name])
}

model PlayerDraft {
  id               String    @id @default(cuid())
  seasonId         String
  divisionId       String    @unique
  name             String    @default("Player Draft")
  status           String    @default("pending") // pending | active | paused | complete
  rounds           Int       @default(5)
  pickTimerSeconds Int       @default(120)       // 0 = no timer
  baseOrder        Json      @default("[]")      // immutable after draft starts
  currentOrder     Json      @default("[]")      // live; updated by slot trades
  currentPickIndex Int       @default(0)
  pickStartedAt    DateTime?
  adminKey         String?   @unique
  version          Int       @default(0)
  createdAt        DateTime  @default(now())
  startedAt        DateTime?
  completedAt      DateTime?
  updatedAt        DateTime  @updatedAt

  season   Season          @relation(fields: [seasonId], references: [id])
  division Division        @relation(fields: [divisionId], references: [id])
  picks    PlayerDraftPick[]

  @@unique([seasonId, divisionId])
}

model PlayerDraftPick {
  id            String   @id @default(cuid())
  playerDraftId String
  pickNumber    Int      // 1-based across full snake sequence
  teamId        String
  playerId      String
  pickedAt      DateTime @default(now())

  playerDraft PlayerDraft @relation(fields: [playerDraftId], references: [id], onDelete: Cascade)
  team        Team        @relation(fields: [teamId], references: [id])
  player      Player      @relation(fields: [playerId], references: [id])

  @@unique([playerDraftId, playerId])
  @@unique([playerDraftId, pickNumber])
}
```

**Draft slot trade flow:**
1. Both captains agree to swap pick positions.
2. Admin applies: `PATCH /api/player-drafts/[id]/order` with new `currentOrder`.
3. Server recomputes from `currentPickIndex` onward. Past picks unaffected.
4. SSE emits updated state.

**Draft completion transaction:**
```
$transaction:
  1. Read all PlayerDraftPick rows ordered by pickNumber
  2. Upsert TeamMember for each (teamId, playerId, role: player.role)
  3. Set PlayerDraft.status = "complete", completedAt = now()
```

---

# Proposed Match-Bound GodDraft Model

**Additive change to `Draft`:**
```prisma
model Draft {
  // ... all existing fields unchanged ...
  gameId  String?  @unique  // null = standalone
  game    Game?    @relation(fields: [gameId], references: [id])
}
```

**Auto-provisioning at match creation (BO3 example):**
1. Generate `homeTeamCaptainKey` + `awayTeamCaptainKey` (stored on `Match`)
2. Create 3 `Game` rows (gameNumber 1, 2, 3)
3. Create 3 `Draft` rows (one per Game) with `captainAKey`/`captainBKey` from Match
4. Pre-populate `DraftPick` stubs from `TeamMember` rosters (starters, `isSub = false`)

**Vault update (query-side only, no schema change):**
```js
// lib/usedGodIds.js
export async function getEffectiveVaultedGodIds(draftId) {
  const draft = await prisma.draft.findUnique({ where: { id: draftId }, include: { game: true } });
  if (!draft.gameId) return readUsedGodIds(draft); // standalone path unchanged
  // match-bound: aggregate from sibling games
  const siblingPicks = await prisma.draftPick.findMany({
    where: { draft: { game: { matchId: draft.game.matchId, gameNumber: { lt: draft.game.gameNumber } } } },
    select: { godId: true },
  });
  return [...new Set([...siblingPicks.map(p => p.godId).filter(Boolean), ...readUsedGodIds(draft)])];
}
```

---

# Migration Strategy

**Order of migrations (each is additive, no existing data touched):**
1. `Season` table
2. `Division` table
3. `Org` table
4. `Team` + `TeamMember` tables
5. `Match` + `Game` tables
6. `Draft.gameId` nullable FK to `Game`
7. `PlayerDraft` + `PlayerDraftPick` tables

**TeamMember creation paths:**
- Manual admin entry (bootstrapping)
- PlayerDraft completion transaction (automated, every season)
- CSV import creates `Player` rows only — not `TeamMember` rows

**Standalone draft path stays clean:** `gameId = null` hits existing vault path with no branching.

---

# Implementation Plan

## Milestone 1: Foundation
- **PR 1** — Season + Division + Org + Team + TeamMember schema + admin CRUD (issue #67)
- **PR 2** — Match + Game schema + schedule editor + auto-provisioning (issue #XX)
- **PR 3** — CSV player import (issue #XX)

## Milestone 2: Match-Bound God Drafts
- **PR 4** — `Draft.gameId` nullable FK (issue #XX)
- **PR 5** — Vault scope shift per-Draft → per-Match (issue #XX)
- **PR 6** — Relax `DraftPick.playerId` nullable + Lineup Confirmation (issue #XX)

## Milestone 3: Player Draft
- **PR 7** — `lib/playerDraftOrder.js` pure logic (issue #69)
- **PR 8** — PlayerDraft + PlayerDraftPick schema (issue #XX)
- **PR 9** — PlayerDraft active pick flow API + SSE + admin UI (issue #XX)
- **PR 10** — PlayerDraft completion → TeamMember transaction (issue #XX)

## Milestone 4: Season Ops
- **PR 11** — Public Teams + Team detail pages (issue #XX)
- **PR 12** — Public Schedule + Match detail pages (issue #XX)

## Cross-cutting
- **PR 0** — `docs/draft-architecture.md` (issue #68) — merge before any draft PR
- **PR 13** — Documentation cleanup pass (issue #XX)

---

# Critical Files for Implementation

| File | Role |
|---|---|
| `prisma/schema.prisma` | All model additions originate here |
| `lib/usedGodIds.js` | Vault logic; add `getEffectiveVaultedGodIds` for per-Match scope |
| `lib/draftState.js` | `buildDraftState` must consume new vault function and expose `gameId` |
| `lib/draftAuth.js` | Extend `resolveRole` for `TeamMember.isCaptain` + `Match` captain keys |
| `lib/playerDraftOrder.js` | New — pure `buildPickSequence` |
| `lib/playerDraftState.js` | New — `buildPlayerDraftState` |
| `lib/godDraftRules.js` | Optional new — extract `applyDraftSelection`, `applyTimeout`, `applyResetRequest` |

---

*Audited: SAL (`diese-tech/sal-site`) vs FRH (`diese-tech/franks-retirement-home`). SAL reference files: `src/lib/god-draft-rules.ts`, `src/lib/god-draft-format.ts`, `src/lib/draft-data.ts`, `src/types/draft.ts`. Do not copy — translate.*
