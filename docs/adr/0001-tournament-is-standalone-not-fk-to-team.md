# Tournament is a standalone concept, not tied to Season/Division/Team

Status: accepted

The bracket feature could have modeled participants as a foreign key to the existing `Team` entity, since tournaments will usually be populated with the current season's teams. We decided against this: `Tournament` and its `Participant` slots are free-text and carry no FK to `Team`, `Division`, or `Season`.

This is deliberate, not an oversight — the admin explicitly wants to reuse this feature for one-off events, guest brackets, and anything else that doesn't map to a real `Team` row, and typing a name into a text box must stay the fastest path to populating a bracket. The trade-off is that a Tournament can't validate participant names against the roster, and renaming a `Team` won't retroactively rename it in past tournaments — both accepted as fine for a beer league.
