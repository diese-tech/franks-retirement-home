# FRH Draft Architecture

Canonical reference for FRH's draft systems. Read this before opening or reviewing any draft PR.

---

## 1. Domain Distinction

FRH has **two separate draft systems**. They share no tables and no flows.

| System | Models | Purpose | Status |
|---|---|---|---|
| **GodDraft** | `Draft`, `DraftPick`, `DraftBan`, `DraftChat` | Per-game pick/ban of gods for a 5v5 game | Exists |
| **PlayerDraft** | `PlayerDraft`, `PlayerDraftPick` | Per-season snake draft of players to teams | New (S9) |

**GodDraft** is what the current `/draft/[id]` room runs. Status machine: `pending → lobby → banning → picking → complete`. It can be **standalone** (scrims/testing, `Draft.gameId = null`) or **match-bound** (`Draft.gameId` set to a `Game` row).

**PlayerDraft** creates the persistent team rosters that feed into match-bound GodDrafts. Status machine: `pending → active → paused → complete`. Completion writes `TeamMember` rows.

---

## 2. Vault Scope Contract

The vault is the set of gods that cannot be picked because they were already used in a prior game of the same series.

| Draft type | Vault source | Implementation |
|---|---|---|
| Standalone (`gameId = null`) | `Draft.usedGodIds` JSON column | `lib/usedGodIds.js::readUsedGodIds` (unchanged) |
| Match-bound (`gameId != null`) | All `DraftPick.godId` values from sibling `Game` rows of the same `Match` where `gameNumber < current`, union with `Draft.usedGodIds` | `lib/usedGodIds.js::getEffectiveVaultedGodIds` (added in #73) |

**Rule:** only **picks** from prior games are vaulted. Bans do not carry over between games.

**Game 1 vault is always empty** (no prior games exist).

Standalone draft vault behavior is unchanged by the match-bound additions.

---

## 3. buildPickSequence Algorithm

Defined in `lib/playerDraftOrder.js`.

```js
buildPickSequence(currentOrder, rounds)
```

- `currentOrder`: array of teamIds in the live pick order
- `rounds`: number of rounds (typically 5 for a 5-player roster)
- Returns: flat array of teamIds — the full snake pick sequence

**Algorithm:**
- Even round index (0, 2, 4…): append `currentOrder` as-is
- Odd round index  (1, 3, 5…): append `currentOrder` reversed

**Examples:**

```
buildPickSequence(['A','B','C','D'], 1) → [A, B, C, D]
buildPickSequence(['A','B','C','D'], 2) → [A, B, C, D, D, C, B, A]
buildPickSequence(['A','B','C','D'], 3) → [A, B, C, D, D, C, B, A, A, B, C, D]
buildPickSequence(['A','B'], 5)         → [A, B, B, A, A, B, B, A, A, B]
```

`PlayerDraft.currentPickIndex` is a 0-based cursor into this sequence. The server reads `currentOrder` and `rounds` from the DB, calls `buildPickSequence`, and indexes into it to find the current team.

---

## 4. Draft Slot Trade Flow

Captains can bilaterally agree to swap their pick positions before or during a draft.

**Two order fields on `PlayerDraft`:**

| Field | Mutability | Purpose |
|---|---|---|
| `baseOrder` | Immutable after `status = active` | Audit trail of the originally approved order |
| `currentOrder` | Mutable by admin | Live order used by `buildPickSequence` |

**Trade flow:**
1. Both captains agree (out of band — Discord, etc.).
2. Admin applies the trade: `PATCH /api/player-drafts/[id]/order` with the new `currentOrder` array.
3. Server validates all teamIds are present, then writes `currentOrder`.
4. `buildPickSequence(currentOrder, rounds)` is recomputed. **Past picks are unaffected** — `currentPickIndex` is not moved; only future slots change.
5. `PlayerDraft.version` increments; SSE emits the updated state.

Before the draft starts (`status = pending`): both `baseOrder` and `currentOrder` can be freely changed. At `start`, `baseOrder` is frozen to the current `currentOrder` value.

---

## 5. TeamMember Creation Guarantee

PlayerDraft completion is a **single atomic transaction**. Either all `TeamMember` rows are written and the draft is marked `complete`, or nothing changes.

```
$transaction:
  1. Validate: every team has exactly `rounds` picks
  2. For each PlayerDraftPick:
       upsert TeamMember(teamId, playerId, role=player.role, isCaptain=false)
  3. Update PlayerDraft: status='complete', completedAt=now()
```

**Why upsert (not create):** a player may have been manually assigned to a team before the draft ran (admin bootstrapping). `upsert` avoids constraint errors and updates the role if it changed.

**Invariant:** if the transaction fails (DB error, validation error, etc.), no `TeamMember` rows are written and `PlayerDraft.status` stays unchanged. There is no partial completion state.

---

## 6. Division Constraint

FRH Season 9 has two divisions: **Hospice** and **Rehabilitation**.

- Every `Player` belongs to exactly one division (stored as `Player.division` string).
- Every `PlayerDraft` is scoped to one division via `PlayerDraft.divisionId`.
- **Pick validation:** `player.division === playerDraft.division.name` — strict equality. Not a tier comparison. A Hospice player cannot be drafted into the Rehabilitation PlayerDraft and vice versa.
- **Schema enforcement:** `PlayerDraft` has `@@unique([seasonId, divisionId])` — exactly one PlayerDraft per division per season.

Season 9 → two `PlayerDraft` rows: one Hospice, one Rehabilitation.

`Division.tier` (1 = Hospice, 2 = Rehabilitation) is for **display/sorting only**. It is not used in any pick eligibility check.

---

## 7. Standalone Draft Preservation

Standalone drafts (`Draft.gameId = null`) are the permanent fallback for scrims, testing, and ad-hoc play.

- All existing `/api/drafts/*` routes work identically for standalone and match-bound drafts.
- Vault logic branches on `gameId`: null → per-draft vault; non-null → per-match vault.
- The `nextGame` admin action (clears picks/bans, keeps vault) is only relevant for standalone BO series simulation.
- Match-bound drafts are auto-provisioned at match scheduling; standalone drafts are created manually from the admin Drafts tab.
- **No existing standalone draft record or route is modified by match-bound draft additions.**

---

## Related files

| File | Role |
|---|---|
| `lib/playerDraftOrder.js` | Pure `buildPickSequence`, `currentPickTeam`, `totalPicks` |
| `lib/playerDraftState.js` | (planned) `buildPlayerDraftState` — DB aggregation for PlayerDraft |
| `lib/usedGodIds.js` | Vault logic; `getEffectiveVaultedGodIds` handles both standalone and match-bound |
| `lib/draftOrder.js` | GodDraft ban/pick order constants (`BAN_ORDER`, `PICK_ORDER`) |
| `lib/draftState.js` | GodDraft state aggregation for SSE and `/state` endpoint |
| `lib/draftAuth.js` | `resolveRole` — maps URL key tokens to admin/captainA/captainB/spectator |
| `prisma/schema.prisma` | Source of truth for all model definitions |
| `docs/s9-draft-architecture-plan.md` | Full SAL audit reference and implementation plan |
