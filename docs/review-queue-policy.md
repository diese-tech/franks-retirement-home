# FRH Review Queue Policy

**Status: Binding — Season 9 and beyond.**

This document is the authoritative policy for all stat-affecting data in Frank's Retirement Home. Any PR that queries staging tables from public routes, auto-approves data, or bypasses the review queue is incorrect and must be rejected.

---

## What counts as stat-affecting data

Stat-affecting data is any record that:

- Determines a game winner (`Game.winnerTeamId`)
- Contributes to standings computation (`lib/standings.js`)
- Appears in any public-facing CSV export
- Contributes to a `StatLine` row

Examples of stat-affecting data: match submission results, per-player KDA and damage stats, game durations, reported winning teams.

Examples of data that is **not** stat-affecting: god names, player profiles, team names, division metadata, draft room activity (picks, bans, chat).

---

## Staging tables vs. status flags

FRH uses **separate staging tables** for pending/unreviewed data, not status flags on canonical rows. This is a binding architectural decision.

**Canonical tables** (public-readable, standards-grade):
- `StatLine` — approved stats only
- `Game.winnerTeamId` — set only on approval

**Staging tables** (admin-only):
- `MatchSubmission` — captain submissions awaiting review
- `SubmissionAttachment` — screenshot files attached to submissions
- `OcrExtraction` — raw OCR output from ForgeLens
- `ExtractedStatLine` — parsed stat rows pending admin approval

**Why staging tables instead of a status column on a shared table:**

A status-flagged approach (e.g., `StatLine.status = "pending"`) requires every public query to remember to filter `WHERE status = 'approved'`. One missed `WHERE` clause leaks pending data. With separate tables, the Prisma schema makes it structurally impossible: `StatLine` has no concept of "pending" because it only exists after approval.

---

## Who can approve

Only admin sessions (`requireAdmin`) can approve, reject, or supersede submissions. There is no captain self-approval path in Season 9.

### Captain-side review boundary (Season 9 decision)

**Season 9 uses admin-only review.** Captains submit; admins approve. Captains cannot approve their own submissions or their opponent's. This is intentional:

- Captains have an obvious conflict of interest on result reporting.
- The league is small enough for admin approval latency to be acceptable.
- Captain-editable fields (e.g., correcting a player name typo) may be added in a future season after explicit design review. That decision will be documented as an addendum to this file.

The captain-side review boundary question is deferred to post-S9 and requires an explicit re-plan before implementation.

---

## Pending data is invisible to public queries

The following routes must never read staging tables:

- Any route under `app/` that is not behind `requireAdmin`
- `lib/standings.js`
- `/api/exports/standings.csv`, `/api/exports/schedule.csv`, `/api/exports/roster.csv`, `/api/exports/stats.csv`

The enforcement mechanism is the schema boundary: public routes read `StatLine` and `Game`, not `ExtractedStatLine` or `OcrExtraction`. A code review that adds a staging table import to a public route must be rejected.

The admin-only export `/api/exports/pending-ocr.csv` is an exception. It requires admin auth, returns only staging data, and every filename and row in the export is visibly marked "PENDING — NOT OFFICIAL."

---

## Rejection retention rules

Rejected submissions are never deleted. Status transitions only:

- `pending` → `in_review` → `approved`
- `pending` → `in_review` → `rejected` (with `rejectionReason`)
- `approved` → `superseded` (when a later corrected submission replaces it)

Rejected and superseded submissions remain in the database for audit. They do not affect standings. The `AuditLog` table (when implemented) captures who made each transition and why.

---

## Supersede semantics

When a captain resubmits a result correction:

1. The new submission enters as `pending`.
2. Admin reviews the new submission alongside the original.
3. On approval of the new submission, the original transitions to `superseded`.
4. Standings recompute using the newly approved `Game.winnerTeamId`.

A superseded submission's `StatLine` rows are not deleted; they are replaced by the newly approved `StatLine` rows. The superseded rows remain queryable for audit but are excluded from all active queries by the absence of any reference to them from live `Game` rows.

---

## Reconciliation expectations between FRH and ForgeLens

FRH is the source of truth. ForgeLens is a worker. Approved `StatLine` rows in FRH are canonical regardless of what ForgeLens originally produced. The reconciliation flow is:

1. ForgeLens returns `ExtractedStatLine` rows via callback.
2. Admin reviews the rows for accuracy, corrects any discrepancies in the admin UI, and approves.
3. Approval writes `StatLine` rows from the (potentially corrected) `ExtractedStatLine` rows.
4. If ForgeLens later re-processes the same screenshot (e.g., after a parser fix), the resulting `OcrExtraction` is a new supersede candidate — it does not automatically overwrite the approved `StatLine`.

ForgeLens regressions (parser changes that alter output) are surfaced by comparing new `ExtractedStatLine` rows against existing approved `StatLine` rows during review. The admin decides whether to supersede or keep existing canonical rows.

---

## Hard prohibitions

1. Do not auto-approve any OCR or CSV-imported data. Ever.
2. Do not query `OcrExtraction` or `ExtractedStatLine` from public routes.
3. Do not allow captains to approve their own submissions.
4. Do not delete `OcrExtraction` or `ExtractedStatLine` rows. Status transitions only.
5. Do not add a "force approve" button or bypass the review queue for expediency.
6. Do not block match submission on ForgeLens availability. Submissions must work whether ForgeLens is up or down.
