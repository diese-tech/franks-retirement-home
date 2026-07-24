# Frank's Retirement Home

League Ops platform for a Smite 2 beer league. Canonical source of truth for seasons, teams, matches, and drafts.

## Language

**Tournament**:
A standalone, admin-defined single-elimination-style bracket event, independent of `Season`/`Division`/`Team`. Reusable for any occasion (playoffs, one-off scrims, side events), not just the active season.
_Avoid_: Bracket (the tournament is the event; "bracket" is its visual/structural representation), Playoffs (too narrow — a Tournament isn't always end-of-season)

**Participant**:
A free-text name an admin types into a Tournament slot. Not a foreign key to `Team` — a Tournament frequently reuses the season's team names, but must also work for guests, byes, or entirely unrelated events.
_Avoid_: Team (reserved for the canonical roster entity), Entrant

**Bracket Match**:
One node in a Tournament's bracket tree — two Participant slots, a winner, and a pointer to the next Bracket Match the winner advances into. Modeled with an optional loser-routing pointer as well, even though only single-elimination logic is active this release, so double-elimination can be added later without a data migration.
_Avoid_: Game (reserved for a game within a league `Match`), Round (a Round is a generation/column of Bracket Matches, not a match itself)

**Ready** (Bracket Match state):
Both of a Bracket Match's Participant slots are filled, but no winner has been recorded yet. Rendered with a subtle glow on the viewer page — this is the state of "the next game to be played."
_Avoid_: Pending, In Progress (this app has no concept of a match actively being played, only decided vs not-yet-decided)

**Decided** (Bracket Match state):
A Bracket Match with a winner recorded. The losing Participant renders crossed out in place; the winning Participant slides down the bracket line into its next Bracket Match slot.
_Avoid_: Completed (reserved for `Tournament` status), Finished
