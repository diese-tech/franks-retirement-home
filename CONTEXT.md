# Frank's Retirement Home

League Ops platform for a Smite 2 beer league. Canonical source of truth for seasons, teams, matches, and drafts.

## Language

**Tournament**:
A standalone, admin-defined single-elimination-style bracket event, independent of `Season`/`Division`/`Team`. Reusable for any occasion (playoffs, one-off scrims, side events), not just the active season.
_Avoid_: Bracket (the tournament is the event; "bracket" is its visual/structural representation), Playoffs (too narrow — a Tournament isn't always end-of-season)

**Participant**:
A free-text name an admin types into a Tournament slot. Not a foreign key to `Team` — a Tournament frequently reuses the season's team names, but must also work for guests, byes, or entirely unrelated events.
_Avoid_: Team (reserved for the canonical roster entity), Entrant
