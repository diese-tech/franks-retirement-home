# Tournament lifecycle is draft → live → completed, and completed stays visible

Status: accepted

A Tournament moves through three states. `draft` is admin-only setup (viewer page hidden). `live` publishes it to the viewer page with real-time updates. `completed` is reached when the final Bracket Match resolves — the page stays visible after this, read-only, with no further polling.

The alternative was to hide or archive a Tournament once it finished, matching "hidden when nothing's live" literally. We rejected that: this league's whole identity is retro league-history flavor ("remember the Season 3 gauntlet"), and a finished bracket is exactly the kind of content people want to link back to. Only a Tournament with zero Bracket Matches yet resolved (still in `draft`) is hidden.
