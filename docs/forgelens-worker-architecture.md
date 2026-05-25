# ForgeLens Worker Architecture

**Status: Binding contract — Season 9.**

This document defines the boundary between Frank's Retirement Home (FRH) and ForgeLens, the OCR and stat-extraction worker. It is the authoritative interface specification. Any deviation requires an explicit re-plan and update to this document.

---

## Purpose

ForgeLens extracts per-player stats from Smite 2 screenshot attachments. It is a separate service from FRH. FRH is the source of truth; ForgeLens is a worker. ForgeLens does not store canonical data.

---

## System responsibilities

| System | Responsibility | Does NOT do |
|---|---|---|
| **FRH** | Source of truth. Stores all canonical data. Owns the review queue. Approves or rejects extracted stats. Sends jobs to ForgeLens. | Call Gemini directly. Store raw model output as canonical. Auto-approve any OCR result. |
| **ForgeLens** | OCR/stat extraction worker. Receives job requests from FRH. Calls Gemini. Returns structured output via signed HMAC callback. | Store canonical league data. Apply approval logic. Access FRH's database directly. |
| **Gemini** | Vision/language model. Called only by ForgeLens. | Be called by FRH. |
| **Neon (PostgreSQL)** | Canonical database for all FRH data. | Be accessed by ForgeLens. |
| **CSV/Excel** | Approved-only public export format. Admin-only pending export format. Fallback import path when ForgeLens is down. | Be the source of truth for any active record. |
| **Discord** | League social layer. Future: webhook notifications on match results and draft completions. | Gate any FRH functionality. |

**Key constraint:** The Gemini API key never enters FRH's environment variables. FRH does not know Gemini exists beyond documentation.

---

## Data flow — submission to canonical stat

1. **Captain uploads screenshot.** Captain submits a match result via `/api/matches/:id/submissions` with optional screenshot attachments. Submission enters with `status = pending`. Attachment URLs are stored in `SubmissionAttachment`.

2. **FRH creates an OCR job.** On screenshot upload, FRH POSTs a job request to ForgeLens (see contract below). FRH stores an `OcrExtraction` row with `status = queued` and the job reference.

3. **ForgeLens processes the job.** ForgeLens downloads the attachment URL, calls Gemini Vision, and parses the response into structured stat rows.

4. **ForgeLens sends a signed callback.** On completion (success or failure), ForgeLens POSTs to `/api/forgelens/callback` with an HMAC-SHA256 signature in the `X-ForgeLens-Signature` header. FRH verifies the signature before processing.

5. **FRH stores the extraction result.** Successful callback: FRH creates `ExtractedStatLine` rows from the parsed output. `OcrExtraction.status` transitions to `completed` or `needs_review` (if confidence is below threshold). Failed callback: `OcrExtraction.status` transitions to `failed`; manual stat entry remains the fallback.

6. **Admin reviews the extraction.** Admin opens the Review Queue, sees pending submissions with their OCR extractions. Admin can edit individual `ExtractedStatLine` fields (correct player names, adjust stats) before approval.

7. **Admin approves.** Approval writes approved `StatLine` rows from `ExtractedStatLine` rows, sets `Game.winnerTeamId`, and triggers standings recompute. `MatchSubmission.status` transitions to `approved`.

8. **Rejection.** Rejection preserves the `OcrExtraction` and `ExtractedStatLine` rows with `status = rejected` and a `rejectionReason`. Manual stat entry is still available for the same game.

9. **Supersede.** If a corrected submission arrives later, admin approves it and the original `MatchSubmission` transitions to `superseded`. Standings recompute.

10. **Public data.** Only approved `StatLine` rows appear in standings, public exports, and match detail pages. Staging tables (`OcrExtraction`, `ExtractedStatLine`) are never queried from public routes.

---

## Job lifecycle

```
queued → processing → completed → [review] → approved
                               → needs_review → approved
                   → failed                  → rejected
                                             → superseded
```

- `queued`: job created in FRH, not yet acknowledged by ForgeLens
- `processing`: ForgeLens has begun processing
- `completed`: ForgeLens returned a successful extraction
- `needs_review`: extraction completed but confidence is below threshold — admin must review carefully
- `failed`: ForgeLens returned a failure; manual entry is the fallback
- `approved`: admin approved; `StatLine` rows written
- `rejected`: admin rejected
- `superseded`: a later approved submission replaced this one

---

## Review queue

The admin review queue is the canonical correctness gate. All stat-affecting data, regardless of source (OCR, manual entry, CSV import), enters the queue and waits for explicit admin approval.

**Queue entry sources:**
- ForgeLens callback (automated)
- Admin manual stat entry form
- CSV stat import (admin-initiated fallback)

**Queue invariants:**
- No automatic approval path exists.
- Pending/extracted rows never affect standings or public pages.
- Rejection is always reversible by creating a new submission.

---

## Data contract

### Job request (FRH → ForgeLens)

```json
{
  "jobId": "clxyz123",
  "callbackUrl": "https://frh.example.com/api/forgelens/callback",
  "attachmentUrl": "https://blob.vercel-storage.com/...",
  "attachmentChecksum": "sha256:abc123",
  "mimeType": "image/png",
  "context": {
    "matchId": "clmatch456",
    "gameId": "clgame789",
    "gameNumber": 1,
    "seasonId": "season-9",
    "homeTeamId": "clteam1",
    "awayTeamId": "clteam2",
    "homeTeamName": "Team Hospice A",
    "awayTeamName": "Team Rehab B"
  }
}
```

### Success callback (ForgeLens → FRH)

```json
{
  "jobId": "clxyz123",
  "status": "completed",
  "confidence": 0.94,
  "parserVersion": "1.2.0",
  "warnings": [],
  "rows": [
    {
      "ign": "FrankWalker42",
      "team": "home",
      "role": "Solo",
      "god": "Hercules",
      "kills": 4,
      "deaths": 2,
      "assists": 7,
      "damageDealt": 43210,
      "damageMitigated": 28900,
      "healing": 0,
      "goldEarned": 12500,
      "structureDamage": 1200
    }
  ],
  "rawModelOutput": "...gemini raw text response..."
}
```

### Low-confidence callback

Same as success callback but `confidence < 0.75` and `warnings` array is populated:

```json
{
  "jobId": "clxyz123",
  "status": "needs_review",
  "confidence": 0.61,
  "parserVersion": "1.2.0",
  "warnings": [
    { "field": "kills", "ign": "FrankWalker42", "reason": "OCR ambiguous: read '4' or '1'" }
  ],
  "rows": [ ... ]
}
```

### Failure callback

```json
{
  "jobId": "clxyz123",
  "status": "failed",
  "errorCode": "GEMINI_TIMEOUT",
  "errorMessage": "Gemini Vision call timed out after 30s",
  "parserVersion": "1.2.0"
}
```

### Malformed / unprocessable callback

FRH returns HTTP 400 for malformed payloads. ForgeLens should log and not retry on 400s. Retry only on 5xx responses from FRH.

---

## Failure modes

| Failure | FRH behavior | ForgeLens behavior |
|---|---|---|
| ForgeLens unreachable at job creation | FRH logs the error; submission remains `pending`; manual stat entry is available | N/A |
| ForgeLens processing timeout | ForgeLens sends failure callback | FRH marks extraction `failed`; manual entry available |
| FRH callback endpoint down | ForgeLens retries with exponential backoff (30s, 60s, 120s, then gives up) | — |
| HMAC signature invalid | FRH returns 401, logs rejection | — |
| Low confidence | ForgeLens sends `needs_review` status | FRH flags extraction; admin reviews carefully |
| Partial extraction (some rows missing) | ForgeLens marks affected row warnings | Admin fills missing fields manually before approval |

**FRH must never block match submission on ForgeLens availability.** A submission with screenshots but a failed or absent OCR extraction is still a valid submission. Manual stat entry covers the fallback path.

---

## CSV / Excel role

CSV is a first-class data path in FRH:

- **Public approved exports** (`/api/exports/stats.csv`): read only from `StatLine`; filename convention `frh-s9-stats-YYYY-MM-DD.csv`.
- **Admin pending export** (`/api/exports/pending-ocr.csv`): reads from `ExtractedStatLine`; requires admin auth; first column is `STATUS = PENDING — NOT OFFICIAL`; filename is `frh-s9-pending-ocr-YYYY-MM-DD.csv`.
- **Admin CSV import** (`/api/imports/stats`): admin pastes or uploads a ForgeLens-formatted CSV; each row becomes an `ExtractedStatLine` with `source = 'manual_csv'`; standard review queue applies; no auto-approval.

The approved-only vs pending split is enforced by filename, column headers, UI banners, and query scope. These must never be blurred.

---

## Security and authentication

**HMAC callback signing:**
- ForgeLens signs each callback body with HMAC-SHA256 using a shared secret (`FORGELENS_HMAC_SECRET` env var in both FRH and ForgeLens).
- FRH verifies the signature in `/api/forgelens/callback` before processing. Invalid signatures return 401.
- The shared secret rotates per season and is never committed to either repository.

**Attachment URL TTL:**
- Screenshot attachment URLs (Vercel Blob or equivalent) are signed and expire after 24 hours. ForgeLens must process within this window. If the URL expires before ForgeLens downloads it, FRH marks the extraction as `failed` and falls back to manual entry.

**Gemini key isolation:**
- The Gemini API key exists only in ForgeLens's environment. FRH's `.env.example` does not reference it. FRH code never imports a Gemini SDK.

---

## Implementation phases

| Phase | What ships | Issue |
|---|---|---|
| P1 | Schema: `OcrExtraction`, `ExtractedStatLine`, `PlayerAlias` staging tables | #63 |
| P2 | Contract test fixtures (JSON payloads for all callback types) | #64 |
| P3 | Live integration: job creation on upload, callback receiver, admin review extension | #65 |

Phases P1 and P2 are independent of ForgeLens being deployed. P3 requires ForgeLens to be reachable at `FORGELENS_URL`.

This document is referenced from:
- `docs/season-9-backlog.md` — issue #38
- `docs/season-9-migration-runbook.md` — P1 schema migration
- `tests/fixtures/forgelens/` — contract test fixtures (P2)
