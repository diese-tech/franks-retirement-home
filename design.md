# Frank's Retirement Home Design Direction

## Product Identity

Frank's Retirement Home is a low-skill, low-stress Smite 2 beer league for friends who want competitive structure without taking themselves too seriously.

The app should feel like an early internet league website rebuilt with modern UX: retro, chaotic, funny, readable, and intentionally unserious.

## Brand Mantra

A low-level beer league of friends playing Smite and Smite 2 competitively.

We stress the importance of having fun, being bad at the game, and creating memorable draft chaos. Grab a beer or a shot of whiskey, because you never know what you're going to see next.

## Visual Direction

Primary references:
- Neo-brutalism
- Early internet webpages
- Windows 98-style panels
- AOL-era league sites
- Retro desktop utilities
- MS Paint-style roughness
- 70s palette with orange accents
- Bitmap / receipt / VCR mono typography

Avoid:
- Generic esports dashboard styling
- Corporate SaaS polish
- Glassmorphism
- Overly serious fantasy UI
- Literal copyrighted character copies

## Tone

Funny, self-aware, league-inside-joke friendly.

The app should sound like:
- "Low skill, high commitment."
- "Draft responsibly."
- "It looks like you're trying to throw Game 1."
- "Captain links generated. Please distribute irresponsibly."
- "No one knows the meta. That's the point."

## UI Principles

1. Retro first, readable always.
2. The joke should never block the action.
3. Important draft actions must be obvious.
4. Use hard borders, chunky shadows, and clear layout zones.
5. Use orange as energy/accent, not the entire palette.
6. Make dark mode feel like an after-hours LAN party.

## Component Ideas

- RetroWindow
- RetroTitleBar
- BrutalButton
- PixelBadge
- DraftProgressBar
- TerminalLog
- MascotCallout
- FileCard
- DraftPhasePanel

## Mascot Direction

Use original FRH-inspired helper characters:
- FrankBot: a Clippy-style league assistant
- Cane Courier: an early-internet running mascot with retirement-home energy
- Admin Gremlin: appears in admin workflows and warnings

Do not directly copy Clippy, AOL Running Man, Windows branding, or other protected assets.

## Draft Room Direction

The draft room should feel like a retro desktop application.

Suggested layout:
- Team A panel
- Team B panel
- Center pick/ban phase panel
- Draft progress bar
- Event log / chat terminal
- Current actor callout

For phased drafting, show:
- Current phase
- Current step
- Current team
- Remaining bans/picks
- Used gods / unavailable gods

## Dark Mode

Dark mode should feel like an after-hours LAN party:
- Deep navy/purple base
- Orange, cyan, lime, and violet accents
- Terminal-style panels
- Neon but not unreadable

## Implementation Notes

Create reusable styling primitives instead of one-off CSS.

Recommended components:
- `components/RetroWindow.js`
- `components/BrutalButton.js`
- `components/MascotCallout.js`
- `components/DraftProgressBar.js`

Design work should improve clarity and personality without changing draft logic.
