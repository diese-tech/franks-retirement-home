# Single elimination only, but Bracket Match models a loser route too

Status: accepted

Only single-elimination bracket logic ships in this release — a `Bracket Match` has a winner and a pointer to the next `Bracket Match` the winner advances into. We also added an optional loser-routing pointer on the same model, even though nothing populates or reads it yet.

This looks like dead schema at first glance, which is why it's worth recording: double-elimination is a plausible near-future request (Challonge's most iconic format), and a losers bracket needs every match to carry that second routing pointer from the start — retrofitting it later means migrating every existing `Bracket Match` row. Paying for the column now, while it costs nothing to leave unused, avoids that migration.
