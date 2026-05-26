# FRH League Operations Lifecycle

**Status: Canonical operational doctrine — binding for Season 9+**

This document defines the operational model for Frank's Retirement Home (FRH).

FRH is not a standalone draft tool.
FRH is a League Operations system that contains drafting subsystems.

This document exists to:

- define operational ownership
- define system authority boundaries
- define season lifecycle behavior
- define match governance
- define draft lifecycle rules
- define OCR/review truth publication
- prevent architectural drift

If implementation conflicts with this document, implementation is wrong unless this document is intentionally amended.

---

# 1. Product Thesis

FRH is a one-league, multi-season League Operations platform for Smite 2 communities.

The system supports:

- persistent player identities
- seasonal team structures
- player drafts
- match scheduling
- game-level god drafts
- OCR-assisted stat ingestion
- human-reviewed official records
- public standings and player cards

The primary product is league operations.
Drafting is a subsystem.

---

# 2. Canonical Entity Hierarchy

```text
League
└── Season
    └── Teams
        └── TeamMembers
            └── Matches
                └── Games
                    └── GodDrafts
```

Separately:

```text
PlayerDraft
→ creates or modifies seasonal TeamMember assignments
→ populates teams for a season
```

Important distinction:

- `PlayerDraft` builds teams.
- `GodDraft` handles per-game picks and bans.

These are separate systems sharing draft terminology.

---

# 3. Seasonal Lifecycle

Each season is operationally isolated.

Persistent across seasons:

- Player identity
- All-time player statistics
- Historical season summaries
- God data
- Admin configuration

Reset or archived per season:

- Teams
- Team memberships
- Matches
- Games
- GodDrafts
- OCR staging rows
- Review queues
- Pending submissions
- Reschedule requests
- Sub approvals
- Temporary operational evidence

FRH is intentionally:

```text
one league
multiple seasons
```

FRH is not currently a multi-tenant platform.

---

# 4. PlayerDraft System

The PlayerDraft system exists to populate seasonal teams.

PlayerDraft responsibilities:

- assign players to teams
- support snake draft logic
- define seasonal rosters
- establish captains and substitutes

PlayerDraft does NOT:

- handle god picks/bans
- create match rooms
- manage game-level draft flow

Operational flow:

```text
New Season
→ PlayerDraft occurs
→ Teams become populated
→ Match scheduling begins
```

A player may only belong to one active team per season.

Sub appearances do not duplicate player identity.

---

# 5. Team and Roster Rules

A player belongs to exactly one active team per season.

Players persist permanently.
Teams do not.

A player may appear as:

- active roster player
- approved substitute
- emergency substitute

All stats always attach to the permanent Player identity.

There must never be duplicate player identities for substitute appearances.

Suggested operational modeling:

```text
Player = permanent identity
TeamMember = seasonal assignment
StatLine = actual game participation
```

---

# 6. Match Lifecycle

Admin creates official matches.

Captains and players operate match flow.
Admins supervise and moderate.

Operational lifecycle:

```text
Admin schedules Match
→ Match Room becomes visible
→ Eligible actions unlock during match window
→ Captains operate GameDrafts
→ Match is played
→ Captains/players submit results
→ OCR extraction occurs
→ Admin reviews
→ Official truth published
```

Public spectators may view matches and drafts through spectator shells.

---

# 7. Match Eligibility Window

Each match contains two timestamps:

```text
defaultScheduledAt
scheduledAt
```

Definitions:

- `defaultScheduledAt` = original official schedule anchor
- `scheduledAt` = currently approved play time

Eligibility windows derive ONLY from `defaultScheduledAt`.

Operational rule:

```text
eligibleStart = defaultScheduledAt - 6 days
eligibleEnd = defaultScheduledAt + 6 days
```

Rescheduling changes the agreed play time only.

Rescheduling does NOT:

- extend the eligibility window
- shift the eligibility window
- bypass season governance

Outside the eligibility window:

- captains cannot draft
- captains cannot submit reports
- normal match actions are locked

Admins may override if necessary.

---

# 8. Match Rescheduling Policy

Rescheduling is a governance workflow.
It is not a freeform self-service calendar system.

Operational flow:

```text
Captains discuss reschedule
→ Captain submits request
→ Opposing captain acknowledges or disputes
→ Admin reviews
→ Admin approves or denies
→ Approved time updates scheduledAt
```

Captains may coordinate through:

- Discord channels
- Discord DMs
- approved league communication channels

Evidence may include:

- Discord links
- pasted communication summaries
- admin notes
- text evidence

V1 intentionally avoids large attachment/file infrastructure.

Recommended operational schema:

```text
RescheduleRequest
- matchId
- proposedScheduledAt
- requestedByCaptainId
- opposingCaptainResponse
- status
- evidenceText
- adminDecision
- adminNote
```

Authority boundaries:

| Role | Authority |
|---|---|
| Players | observe and participate |
| Captains | request / acknowledge / dispute |
| Admins | approve / deny / override |
| System | enforce approved schedule |

Admin approval is always final.

---

# 9. GodDraft Lifecycle

Each Game contains its own GodDraft.

GodDrafts are isolated per game.

Completed prior games must never be affected by later draft resets.

Operational flow:

```text
Game begins
→ GodDraft opens
→ Captains draft
→ Draft completes
→ Game played
→ Match report submitted
```

The system must support:

- spectators
- captains
- admins
- roster visibility
- vault tracking

Standalone draft rooms remain supported for scrims and testing.

---

# 10. Draft Failure and Reset Rules

FRH intentionally mirrors in-game lobby behavior.

Operational rules:

```text
Skipped ban
→ draft continues

Skipped pick
→ current GameDraft resets
```

A reset affects ONLY:

- the current game draft

A reset must NEVER:

- reset prior completed games
- wipe prior vault history
- invalidate completed match records

If a captain disappears:

- admins may manually promote a temporary captain
- the system may suggest eligible replacements
- automatic promotion should not occur without admin approval

---

# 11. Captain and Admin Authority

Operational hierarchy:

| Role | Responsibility |
|---|---|
| Admin | governance, moderation, scheduling, disputes, overrides |
| Captain | draft participation, match coordination, submissions |
| Player | participation, stats, identity |
| System | orchestration, enforcement, standings |

Admins are intentionally supervisory.

Captains operate matches.

Players interact primarily through:

- match participation
- submissions
- public pages
- player cards

---

# 12. Substitute Policy

Substitutes are permitted.

Operational assumptions:

- same-division substitutes preferred
- admin approval required
- emergency substitutes allowed if approved

Eligibility model:

```text
Eligible player =
rostered player
OR approved substitute
OR admin-approved emergency substitute
```

Games involving substitutes should be flaggable.

Recommended operational indicators:

```text
Game.hasSub
StatLine.isSubAppearance
```

Sub participation affects:

- team records
- player cards
- stat aggregation
- review queue visibility

Sub appearances must remain attached to the permanent Player identity.

---

# 13. OCR and Match Reporting Flow

Captains and players submit match reports.

FRH performs OCR extraction directly through `lib/gemini.js`.

Operational flow:

```text
Match played
→ screenshots/results submitted
→ OCR extraction runs
→ extracted rows enter staging
→ admins review
→ approved records become canonical
→ standings/player cards update
```

OCR responsibilities:

- identify participating players
- identify gods played
- identify stat lines
- assist review workflow

OCR is assistive only.

OCR is never authoritative.

---

# 14. Review Queue and Official Truth

The review queue defines official truth publication.

Core rules:

- pending rows are staging only
- public pages never read staging data
- OCR never auto-approves
- admin approval is authoritative

Official publication flow:

```text
Pending submission
→ Admin review
→ approve / deny / adjust
→ canonical StatLine written
→ public site updates
→ Discord publication occurs
```

Database writes are the canonical source of truth.

---

# 15. Historical Stats and Player Persistence

Player identity persists permanently.

Seasonal operational data does not.

Player cards may contain:

- current season stats
- historical season summaries
- all-time stats
- role history
- draft history

The system should support:

```text
PlayerSeasonStats
PlayerAllTimeStats
```

Historical approved stats may remain archived for long-term reporting.

Temporary operational evidence may be removed between seasons.

---

# 16. Season Rollover Workflow

Season rollover is an operational workflow.

It is not a destructive wipe button.

Operational flow:

```text
Close Season
→ finalize standings
→ archive season summaries
→ update all-time stats
→ lock prior season

Open New Season
→ create new Season
→ clear operational slate
→ begin PlayerDraft setup
```

Suggested admin protections:

- block rollover if pending reviews exist
- block rollover if unresolved disputes exist
- require typed confirmation
- snapshot all-time stats before rollover

Recommended confirmation:

```text
START SEASON 10
```

---

# 17. Operational Invariants

These rules are binding.

```text
- Players persist across seasons
- Teams do not persist across seasons
- Approved stats become canonical truth
- Public routes never read staging data
- Match windows derive from defaultScheduledAt
- Reschedules never extend eligibility windows
- GodDraft resets affect current game only
- Player identity is never duplicated for sub appearances
- OCR is assistive, not authoritative
- Admin approval is final authority
- Database writes are canonical truth
- Drafting is a subsystem of league operations
```

These invariants exist to prevent architectural drift.
