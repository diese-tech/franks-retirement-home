# Framer Motion drives bracket slide/cross-out animation

Status: accepted

The viewer page adds Framer Motion as a new dependency — the first animation library in this codebase, which otherwise relies on plain CSS/Tailwind. It's used for exactly one thing: layout-aware transitions on the bracket, keyed by Participant identity, so that when the SSE stream delivers a new state, a participant who has moved between Bracket Match slots animates a slide rather than popping into place.

The alternative was hand-rolling a FLIP (First-Last-Invert-Play) transition with manual position measurement and CSS transforms. We rejected that: it's a well-understood but fiddly class of animation code to write and maintain correctly (especially for a bracket tree, where a slide can be a multi-step move down several rounds), and Framer Motion's `layout`/`AnimatePresence` primitives are built for exactly this "shared element moves between renders" case. The cost is one new, small, narrowly-scoped dependency.
