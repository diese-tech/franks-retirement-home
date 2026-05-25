# ForgeLens Callback Contract — Test Fixtures

These fixtures define the exact JSON payloads ForgeLens sends to `POST /api/forgelens/callback`.
Use them for integration tests and to validate the FRH callback handler.

All callbacks include `X-ForgeLens-Signature: sha256=<hmac>` computed over the raw request body
using `FORGELENS_HMAC_SECRET`.

---

## 1. Successful extraction (high confidence)

```json
{
  "jobId": "clmock_job_001",
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
    },
    {
      "ign": "GrimReaper99",
      "team": "home",
      "role": "Jungle",
      "god": "Loki",
      "kills": 8,
      "deaths": 3,
      "assists": 4,
      "damageDealt": 61000,
      "damageMitigated": 4200,
      "healing": 0,
      "goldEarned": 14200,
      "structureDamage": 300
    },
    {
      "ign": "MidOrFeed",
      "team": "home",
      "role": "Mid",
      "god": "Poseidon",
      "kills": 6,
      "deaths": 4,
      "assists": 9,
      "damageDealt": 55400,
      "damageMitigated": 3100,
      "healing": 0,
      "goldEarned": 13800,
      "structureDamage": 0
    },
    {
      "ign": "TankGodSupreme",
      "team": "home",
      "role": "Support",
      "god": "Ares",
      "kills": 1,
      "deaths": 5,
      "assists": 14,
      "damageDealt": 18900,
      "damageMitigated": 41000,
      "healing": 800,
      "goldEarned": 9200,
      "structureDamage": 100
    },
    {
      "ign": "CarryMePlz",
      "team": "home",
      "role": "Carry",
      "god": "Ah Muzen Cab",
      "kills": 7,
      "deaths": 2,
      "assists": 5,
      "damageDealt": 58200,
      "damageMitigated": 2100,
      "healing": 0,
      "goldEarned": 15600,
      "structureDamage": 2400
    },
    {
      "ign": "OpponentA1",
      "team": "away",
      "role": "Solo",
      "god": "Thor",
      "kills": 3,
      "deaths": 6,
      "assists": 5,
      "damageDealt": 38000,
      "damageMitigated": 22000,
      "healing": 0,
      "goldEarned": 10100,
      "structureDamage": 600
    },
    {
      "ign": "OpponentA2",
      "team": "away",
      "role": "Jungle",
      "god": "Kali",
      "kills": 5,
      "deaths": 7,
      "assists": 3,
      "damageDealt": 44100,
      "damageMitigated": 3800,
      "healing": 0,
      "goldEarned": 11200,
      "structureDamage": 0
    },
    {
      "ign": "OpponentA3",
      "team": "away",
      "role": "Mid",
      "god": "Ra",
      "kills": 4,
      "deaths": 6,
      "assists": 8,
      "damageDealt": 41200,
      "damageMitigated": 2900,
      "healing": 3200,
      "goldEarned": 10900,
      "structureDamage": 0
    },
    {
      "ign": "OpponentA4",
      "team": "away",
      "role": "Support",
      "god": "Ganesha",
      "kills": 0,
      "deaths": 4,
      "assists": 12,
      "damageDealt": 14200,
      "damageMitigated": 38500,
      "healing": 1200,
      "goldEarned": 8600,
      "structureDamage": 200
    },
    {
      "ign": "OpponentA5",
      "team": "away",
      "role": "Carry",
      "god": "Medusa",
      "kills": 6,
      "deaths": 5,
      "assists": 4,
      "damageDealt": 52300,
      "damageMitigated": 1800,
      "healing": 0,
      "goldEarned": 13100,
      "structureDamage": 1800
    }
  ],
  "rawModelOutput": "Full scoreboard detected. Home team FRH, Away team BRK. 10 rows parsed."
}
```

**Expected FRH response:** HTTP 200 `{ "ok": true }`
**Expected DB state:** `OcrExtraction.status = "completed"`, 10 `ExtractedStatLine` rows created with `status = "pending"`.

---

## 2. Low-confidence extraction (needs review)

```json
{
  "jobId": "clmock_job_002",
  "status": "needs_review",
  "confidence": 0.61,
  "parserVersion": "1.2.0",
  "warnings": [
    { "field": "kills", "ign": "FrankWalker42", "reason": "OCR ambiguous: read '4' or '1'" },
    { "field": "ign", "ign": "0pponentA5", "reason": "Leading zero detected; may be 'O' (letter)" }
  ],
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
  "rawModelOutput": "Low confidence extraction. Scoreboard partially obscured."
}
```

**Expected FRH response:** HTTP 200 `{ "ok": true }`
**Expected DB state:** `OcrExtraction.status = "needs_review"`, `warnings` array stored, `ExtractedStatLine` rows created. Admin review required before approval.

---

## 3. Failure

```json
{
  "jobId": "clmock_job_003",
  "status": "failed",
  "error": "Image is too blurry to extract scoreboard data. Minimum resolution required: 1280x720."
}
```

**Expected FRH response:** HTTP 200 `{ "ok": true }`
**Expected DB state:** `OcrExtraction.status = "failed"`, `errorMessage` set. Admin must request manual stat entry.

---

## 4. Unknown job ID

```json
{
  "jobId": "clmock_nonexistent",
  "status": "completed",
  "confidence": 0.99,
  "rows": []
}
```

**Expected FRH response:** HTTP 404 `{ "error": "Job not found" }`

---

## 5. Idempotent re-delivery

Same payload as fixture 1, re-sent after FRH already processed it.

**Expected FRH response:** HTTP 200 `{ "ok": true, "idempotent": true }`
**Expected DB state:** No changes — existing `ExtractedStatLine` rows are not duplicated.

---

## 6. Invalid HMAC signature

```
X-ForgeLens-Signature: sha256=0000000000000000000000000000000000000000000000000000000000000000
```

**Expected FRH response:** HTTP 401 `{ "error": "Invalid signature" }`

---

## HMAC generation (for test harness)

```js
import { createHmac } from 'crypto';

const secret = process.env.FORGELENS_HMAC_SECRET;
const body = JSON.stringify(payload);
const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
// Set header: X-ForgeLens-Signature: <sig>
```

---

## FRH env vars required

| Var | Description |
|---|---|
| `FORGELENS_HMAC_SECRET` | Shared secret for HMAC verification. Must match ForgeLens config. |
| `FORGELENS_URL` | Base URL of the ForgeLens worker (e.g. `https://forgelens.example.com`) |
| `FORGELENS_API_KEY` | Bearer token sent when FRH dispatches jobs to ForgeLens |
| `NEXT_PUBLIC_APP_URL` | FRH's public URL, used to construct the callback URL in job submissions |
