# Native Gemini OCR Architecture

**Status: Binding contract — Season 9.**

This document defines the OCR and stat-extraction architecture for Frank's Retirement Home (FRH).

FRH is the source of truth.
FRH also owns OCR orchestration.
Gemini is called directly by FRH through `lib/gemini.js`.

**Correction (2026-07-25):** this document previously claimed the ForgeLens worker path was deprecated/historical-only. That's inaccurate — `app/api/forgelens/callback` (HMAC-verified, receives OCR results and creates `ExtractedStatLine` rows) and `app/api/forgelens/jobs` (admin job listing, backing `/admin/match-report`) are live, non-stub routes, and `docs/LAUNCH_CHECKLIST.md` instructs admins to configure `FORGELENS_URL`/`FORGELENS_API_KEY`/`FORGELENS_HMAC_SECRET` for production. **Both OCR paths are active today**: direct in-app Gemini extraction (`lib/gemini.js`, used by the captain-facing upload flow) and the external ForgeLens worker callback (used by the admin-facing `/admin/match-report` review tool). Treat the rest of this document as describing the Gemini path specifically, not the only path — see `docs/forgelens-callback-fixtures.md` for the callback contract, which is accurate and current despite its own similarly-stale framing.

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

## Historical Note (superseded — see the correction at the top of this document)

Earlier Season 9 planning referenced ForgeLens as an external OCR worker service, and at one point FRH planned to absorb OCR responsibilities entirely into `lib/gemini.js` to reduce infrastructure complexity. That plan did not fully materialize: the ForgeLens callback path shipped and is live in production alongside direct Gemini extraction. Do not treat ForgeLens references elsewhere as purely historical without checking `app/api/forgelens/*` first.
