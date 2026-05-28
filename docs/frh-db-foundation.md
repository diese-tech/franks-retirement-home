# FRH Database Foundation

Migration: `20250528000000_frh_db_foundation`
Branch: `feature/frh-db-foundation`

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

## What Is Intentionally NOT Implemented

- No admin UI for any of these models
- No API routes for BulletinPost, EditorialCase, Wallet, or BettingLine
- No CSV import preview/mapping UI
- No player claim admin review queue page
- No automated stat-signal job for EditorialCase
- No wallet opening / betting logic (schema only)
- No community reactions or comments on BulletinPost (reserved for next phase)

---

## Recommended Next Implementation Order

1. **Profile claim admin queue** — `/admin/claims` page; approve/deny PlayerClaim rows
2. **CSV import mapper/preview** — upload CSV → map columns → preview normalized rows → import
3. **Bulletin Board page** — `/bulletin-board` public listing + `/bulletin-board/[slug]` post view + admin modal editing
4. **Homepage section edit modals** — replace HomepageContent admin editor with per-section modals backed by HomepageSectionConfig + BulletinPost
5. **Fraud/Washed case workflows** — stat-signal job creates EditorialCase drafts; admin reviews and publishes
6. **Fantasy points wallet/team odds** — wallet open-on-first-bet logic, BettingLine admin creation, Bet placement UI
