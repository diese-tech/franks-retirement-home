# Discord Webhook Notifications — FRH S9 Plan

**Status:** Planned (not yet implemented)
**Priority:** P3 — post-S9 launch

---

## Goal

Push automated Discord notifications for key league events so players don't have to poll the FRH site for updates.

---

## Architecture

FRH sends outbound webhooks directly to Discord's Incoming Webhook URL. No bot token or Discord OAuth required. One env var per channel.

```
FRH server action / API route
  → POST Discord Webhook URL (DISCORD_WEBHOOK_*)
  → Discord displays embed in channel
```

No queue, no retry service in v1. Fire-and-forget with a swallowed error (same pattern as `logAudit`). If the webhook fails, league ops continues unblocked.

---

## Env vars

| Variable | Channel | Purpose |
|---|---|---|
| `DISCORD_WEBHOOK_RESULTS` | #match-results | Approved match results |
| `DISCORD_WEBHOOK_SCHEDULE` | #schedule | New matches scheduled |
| `DISCORD_WEBHOOK_DRAFT` | #draft-recap | Draft complete summaries |
| `DISCORD_WEBHOOK_ADMIN` | #admin-log | Admin-only ops notifications |

All optional — if unset, that notification type is silently skipped.

---

## Events and payloads

### 1. Match result approved
**Trigger:** `PATCH /api/submissions/[id]` with `action = 'approve'`
**Channel:** `DISCORD_WEBHOOK_RESULTS`

```json
{
  "embeds": [{
    "title": "Match Result — Week 3",
    "description": "**FRH** def. **BRK** (2–1)",
    "color": 3066993,
    "fields": [
      { "name": "Division", "value": "Hospice", "inline": true },
      { "name": "Format", "value": "BO3", "inline": true }
    ],
    "footer": { "text": "Approved by admin" },
    "timestamp": "2026-05-25T00:00:00Z"
  }]
}
```

### 2. Match scheduled
**Trigger:** `POST /api/matches`
**Channel:** `DISCORD_WEBHOOK_SCHEDULE`

```json
{
  "embeds": [{
    "title": "Match Scheduled — Week 4",
    "description": "**FRH** vs **APEX** · Hospice Division",
    "color": 3447003,
    "fields": [
      { "name": "Date", "value": "<t:1716681600:F>", "inline": true },
      { "name": "Format", "value": "BO3", "inline": true }
    ]
  }]
}
```

Discord timestamp format (`<t:unix:F>`) renders in each user's local timezone automatically.

### 3. Draft complete
**Trigger:** Draft status transitions to `complete`
**Channel:** `DISCORD_WEBHOOK_DRAFT`

```json
{
  "embeds": [{
    "title": "Draft Complete — FRH vs BRK Game 1",
    "description": "Picks locked. [View draft →](https://frh.example.com/draft/clxyz)",
    "color": 15844367,
    "fields": [
      { "name": "Team A", "value": "Hercules · Thor · Medusa · Ah Muzen Cab · Ganesha", "inline": true },
      { "name": "Team B", "value": "Loki · Kali · Poseidon · Chang'e · Ares", "inline": true }
    ]
  }]
}
```

### 4. Admin ops events (internal)
**Trigger:** Key admin actions (submission rejected, player draft completed, roster change)
**Channel:** `DISCORD_WEBHOOK_ADMIN`

Plain text message, no embed required.

---

## Implementation notes

### `lib/discord.js` — to be created

```js
// Fire-and-forget. Never throws.
export async function notifyDiscord(webhookEnvKey, payload) {
  const url = process.env[webhookEnvKey];
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}
```

### Rate limiting

Discord Incoming Webhooks allow 30 requests per minute per webhook. FRH's event rate is well within this limit for S9 scale (a few events per match).

---

## What is NOT planned

- DMs to individual players
- Role pings (@everyone, @here) — too noisy for a beer league
- Real-time draft turn notifications (captains watch the draft UI directly)
- Bot commands or slash commands (no Discord bot token needed for v1)

---

## Dependency

Requires `DISCORD_WEBHOOK_*` env vars to be set in the Vercel project settings. No schema changes.
