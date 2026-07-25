# FRH Database Foundation

Migration: `20250528000000_frh_db_foundation`
Branch: `feature/frh-db-foundation`

**Correction (2026-07-25):** this document describes the schema as originally added, when none of it had a UI or API yet. Most of it has since shipped — see the corrected status at the bottom of this document rather than trusting "What Is Intentionally NOT Implemented" / "Recommended Next Implementation Order" below, both of which are now stale.

---

## Tables Added

### Identity & Profile Claims

| Table | Purpose |
|---|---|
| `User` | Discord-authenticated website identity. One row per Discord account. Separate from the legacy `Player` table — players can exist without a User (e.g. CSV imports). |
| `PlayerClaim` | Audit trail for players claiming their profile. Status: `pending → approved / denied`. Admin reviews queue; `reviewedById` is the reviewing User. |

**Player model additions:** `discordId`, `avatarUrl`, `claimedByUserId` (nullable FK → User). A Player without a claim continues to work unchanged.

---

### CSV Import Staging

| Table | Purpose |
|---|---|
| `RosterImport` | One row per uploaded CSV. Tracks filename, column mapping (JSON), status (`staged / imported / failed`), and who created it. |
| `RosterImportRow` | One row per data row in the CSV. Stores raw JSON, normalized JSON (after column mapping is applied), and per-row validation status/errors. |

No column mapping logic is implemented yet — this is schema only. The intent is that admins upload a CSV, the app stages rows as `RosterImportRow` records, then the admin uses a mapping UI to assign columns before import runs.

---

### Bulletin Board

| Table | Purpose |
|---|---|
| `BulletinPost` | Admin-managed editorial posts. Types: `announcement`, `match_hype`, `player_spotlight`, `team_roast`, `weekly_recap`. Lifecycle: `draft → published → archived`. Slug is unique. Supports soft FK links to Player, Team, Match, Division, Season. |

The public `/bulletin-board` page and its API routes are not yet built. `HomepageContent.bulletin` (JSON array) remains for the transitional period; `BulletinPost` is the target model.

---

### Homepage Section Config

| Table | Purpose |
|---|---|
| `HomepageSectionConfig` | One row per named homepage section (`sectionKey` unique). Stores admin-editable title, subtitle, status text, visibility flag, and display order. Replaces hardcoded section header strings with DB-driven copies. |

No admin UI is built yet. The homepage currently reads from `HomepageContent`; this model is scaffolded for the next UI pass.

---

### Editorial Cases (Fraud Watch / Washed Reports)

| Table | Purpose |
|---|---|
| `EditorialCase` | Stat-informed editorial content. Type: `fraud_watch` or `washed_report`. Lifecycle: `draft → published → archived`. `signalSource` JSON stores the raw stat signal that prompted the case (e.g. a StatLine query result). Soft FK links to Player, Team, Match, Division, Season. |

Intended flow: automated nightly job finds worst KDA / most deaths per week → creates `EditorialCase` records as drafts → admin reviews, adds `charge` / `body`, publishes. No automation is built yet.

---

### Fantasy Points / Team Odds Economy

| Table | Purpose |
|---|---|
| `Wallet` | One wallet per User. `playerId` optional (links wallet to a Player profile). Status: `unopened → active → suspended`. Balance starts at 0; first bet triggers a `starter_grant` transaction of 1,500 points. |
| `WalletTransaction` | Append-only ledger. Types: `starter_grant`, `bet_stake`, `bet_payout`, `admin_adjustment`, `fine`, `bonus`, `void_refund`. Stores `balanceAfter` for point-in-time balance reconstruction. |
| `BettingLine` | Admin-created odds line for a specific match. One line per match normally. Status: `open → locked → settled / void`. Odds stored as integers (e.g. `110` = +110). |
| `Bet` | Player wager on a specific line. Stores stake, potential payout, selected team, and settlement status. |

No real-money gambling. Team-odds fantasy points only. No betting UI in this phase.

---

## Current status (corrected 2026-07-25)

**Shipped since this doc was written:**
- `BulletinPost` — full public page (`/bulletin-board`), admin CRUD (`/api/admin/bulletin`), and community comments/reactions (`/api/bulletin/[id]/comments`, `/api/bulletin/[id]/reactions`) — the "reserved for next phase" comments/reactions gap below is closed.
- `EditorialCase` (Fraud Watch / Washed Reports) — full public page (`/fraud-watch`), admin CRUD (`/api/admin/editorial-cases`).
- `Wallet`/`WalletTransaction`/`BettingLine`/`Bet` — full betting flow: public lines viewer (`/knows-ball`), admin line creation (`/api/admin/betting-lines`), player wallet (`/api/wallet/me`) and bet placement (`/api/bets`).
- Admin editing for Bulletin/Fraud Watch/Betting Lines is **not** in the central `/admin` dashboard — it's an inline "Edit" toggle on each public page itself. This split admin-editing model is tracked as a known usability gap in `docs/production-readiness-audit-2.md`, not something to fix by re-reading this doc.

**Still genuinely not built** (this part of the original doc is still accurate):
- No CSV import preview/mapping UI for `RosterImport`/`RosterImportRow` — schema-only, still.
- No admin review queue page for `PlayerClaim`.
- No `HomepageSectionConfig`-backed per-section edit modals — the homepage editor still edits `HomepageContent` as a whole via `EditorToolbar` in `app/HomepageWrapper.js`.
- No automated nightly stat-signal job creating `EditorialCase` drafts — case creation today is fully manual via the admin CRUD API.
