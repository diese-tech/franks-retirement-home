# Item Build Extraction — Research & Options

**Status:** Post-S9 feature candidate  
**Prerequisite:** Match report pipeline (core stat extraction) must ship first

---

## The constraint

Item builds are only visible on the **Scoreboard tab**, not the Details tab. The Details tab is used for stat extraction (damage, healing, mitigation). To support builds, admins would need to submit a second screenshot per game — the Scoreboard tab alongside the Details tab. This is acceptable UX but doubles the screenshot count for a full set.

---

## The problem with direct item identification

SMITE 2 item icons are small (~32–40px) in the scoreboard. Asking a vision model to name each item from a tiny icon is unreliable — especially for:
- Newer items added after training cutoff
- Items with similar art (many physical damage items look alike)
- Partially obscured slots (stacks, x1, x3 overlays visible in screenshots)

Maintaining a lookup database of all item icons requires ongoing curation and breaks on patches.

---

## The crop-and-store approach (recommended for v1)

Instead of identifying items, extract and store their images directly. The browser renders the cropped icons; no item database needed.

### How it works

**Step 1 — Row detection.**  
Ask Gemini for the y-coordinate range of each player row in the scoreboard. The scoreboard layout is consistent: 5 rows per team, uniform height, same vertical spacing every game. Gemini returns something like:

```json
{
  "chaos": [
    { "ign": "Kuzcode", "rowY": [148, 180] },
    { "ign": "Pain--6paths", "rowY": [182, 214] }
  ],
  "order": [...]
}
```

**Step 2 — Fixed x-offset for items.**  
The items section is always in the right portion of the scoreboard. Once we know the row y-range, the item strip x-range is a hardcoded offset from the right edge of the image. SMITE 2's scoreboard UI has not changed this layout since launch. Example constants:

```js
const ITEMS_X_START = 0.58; // 58% from left edge (normalized)
const ITEMS_X_END  = 0.88; // 88% from left edge
```

These can be calibrated once against a known screenshot and stored as config.

**Step 3 — Crop and store.**  
Server crops each player's item strip using sharp (already available in Node) and stores as a small PNG in Vercel Blob or an equivalent. One image per player per game.

```
/builds/{extractionId}/{ign}.png   ← full item strip per player
```

**Step 4 — Display.**  
The match detail page renders the stored image inline. No item name resolution, no database, no patch maintenance.

### What you get
- Visual build display on match detail pages
- Zero item database maintenance
- Works immediately for any new items (they're just pixels)
- Cropped images are small (~200×40px), storage cost is negligible

### What you don't get
- Searchable/filterable builds ("who builds Deathbringer most?")
- Item names in tooltips (unless identified separately later)
- Build statistics across the league

---

## Option B — Gemini bounding boxes per item slot

Gemini 1.5 Pro and newer models support returning bounding box coordinates for detected objects. The prompt would be:

> "For each player row, return the bounding box `[y_min, x_min, y_max, x_max]` (normalized 0–1) for each individual item icon slot."

This gives individual item crops rather than a full strip. More granular — each slot is a separate image. Useful if you later want to add item name matching (crop → compare against known icon → resolve name).

Downside: Gemini's bounding box precision varies. For small, densely packed icons it may return overlapping or imprecise boxes. Requires validation pass.

---

## Option C — Full item recognition against SMITE 2 item database

Match each cropped icon against a library of known item icons using perceptual hashing or embedding similarity.

### What it requires
- A complete SMITE 2 item icon set (obtainable from the game's asset files or smite.guru/smitefire)
- An ingestion pipeline that updates when Hi-Rez patches items
- A matching service (pHash comparison or a small embedding model)
- An `Item` table in the DB with name, icon URL, stats

### When this makes sense
Only if you want league-wide build analytics ("most-picked items by role", "win rate with X item"). Not needed for S9. Could be a Season 10 project if the league grows.

---

## Recommended path

| Phase | Action |
|---|---|
| S9 launch | No builds. God name only on match/player pages. |
| Post-S9 v1 | Crop-and-store (Option A). Scoreboard screenshot optional on report submission. Renders build strip images on match detail. |
| Post-S9 v2 | If demand exists: add item name recognition (Option C) on top of the stored crops. |

---

## Implementation notes for Option A (when ready)

- Add `sharp` to dependencies (`npm install sharp`) — handles image crop server-side
- Add storage: Vercel Blob (`@vercel/blob`) or keep in `/public/builds/` for small leagues
- New DB field: `ExtractedStatLine.buildImageUrl String?`
- Calibrate `ITEMS_X_START` / `ITEMS_X_END` constants against 3–4 real screenshots before shipping
- The stacks overlays (`x1`, `x3` badges) are cosmetic — cropping the strip captures them naturally

---

## Screenshot requirements (when builds are added)

| Screenshot | Required for | 
|---|---|
| Details tab | Stats (damage, healing, mitigation, K/D/A) — always required |
| Scoreboard tab | Item builds — optional, only if build display is enabled |

Admins submit Details always. Scoreboard is an optional second upload per game if the league wants build history.
