# Native Gemini OCR Architecture

**Status: Binding contract — Season 9.**

This document defines the OCR and stat-extraction architecture for Frank's Retirement Home (FRH).

FRH is the source of truth.
FRH also owns OCR orchestration.
Gemini is called directly by FRH through `lib/gemini.js`.

The previous standalone ForgeLens worker architecture is deprecated and retained only as historical context.

---

## Current Architecture

| System | Responsibility |
|---|---|
| FRH | Canonical source of truth, review queue owner, OCR orchestration, Gemini caller |
| Gemini | Vision extraction model used for screenshot parsing |
| Supabase PostgreSQL | Canonical database |
| CSV/Excel | Export + fallback import layer |
| Discord | Social + operational notification layer |

---

## Core Rules

1. `lib/gemini.js` is the sole Gemini caller.
2. `GEMINI_API_KEY` exists only in FRH environment variables.
3. OCR data is never canonical until approved.
4. Public routes never read staging tables.
5. Human approval is mandatory for all stat-affecting data.
6. Standalone drafts remain permanently supported.

---

## OCR Flow

1. Captain uploads screenshots.
2. FRH creates `MatchSubmission` + `SubmissionAttachment` rows.
3. FRH calls Gemini directly through `lib/gemini.js`.
4. FRH stores raw extraction output in:
   - `OcrExtraction`
   - `ExtractedStatLine`
5. Admin reviews extracted rows.
6. Approved rows become canonical `StatLine` rows.
7. Standings recompute from approved data only.

---

## Staging Boundary

These tables are staging-only and admin-facing:

- `MatchSubmission`
- `SubmissionAttachment`
- `OcrExtraction`
- `ExtractedStatLine`

These tables are canonical/public:

- `StatLine`
- `Game`
- `Match`
- `Team`
- `Season`

Public routes, exports, standings, and APIs must never query staging tables.

---

## Failure Handling

If Gemini extraction fails:

- Match submission still succeeds.
- Admin manual entry remains available.
- OCR failure must never block league operations.

If extraction confidence is low:

- Extraction is flagged for review.
- Admin corrects rows before approval.

No OCR result may auto-approve.

---

## CSV / Excel Role

CSV remains a first-class operational tool.

Approved exports:
- read from canonical tables only
- safe for public distribution

Pending exports:
- admin-only
- visibly marked PENDING
- sourced from staging tables only

CSV imports enter the same review queue as OCR results.

---

## Historical Note

Earlier Season 9 planning referenced ForgeLens as an external OCR worker service.

FRH later absorbed OCR responsibilities directly to reduce infrastructure complexity, deployment coordination, callback orchestration, and external service drift.

Any remaining references to ForgeLens in older docs should be treated as historical planning language, not active architecture.
