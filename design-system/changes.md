# What changes from the live site

This system is a proposed redesign of whos-that-llm.com, built from its `DESIGN.md` and `app/globals.css`. The brand stays: the name, the logo files, and ink, paper and teal as the only brand colors.

| Area | Live site | This system | Why |
|---|---|---|---|
| Hidden model bubble | Light grey card with a border | `hidden`: the logo's ink bubble in light, `#262626` in dark | The suspect gets the logo's voice; the transcript reads at a glance |
| Player bubble | Card with border | `player` pale teal, tail bottom-right | Two speakers told apart by ground and corner, not only position |
| Message counter | Ten thin bars | Ten antenna-dot pips: filled, ring, empty | Shape carries state; echoes the robot |
| Buttons | Flat fill, scale 0.97 on press | Arcade key: hard `shadow-press` edge, 3px travel | A game, not a form |
| Hover on filled buttons | Teal press with white text | `text` on `canvas` (ink in light, paper in dark) | Logo pair; no white on teal |
| Traits | Rows with a pill when matched | Four evidence tiles: dashed unknown, check hit, cross miss | Reads as clues collected; works without color |
| Result | Big teal number on a card | Ink slab with the tail corner and a 112px display number | The model's last word, the moment worth sharing |
| Difficulty | 4px colored left edge | Dot plus word (lobby, leaderboard) | Clearer, and drops the colored-edge card |
| Medium text, light | `#DBA800` (1.7:1 on canvas) | `#7a5c00` (above 4.5:1) | Fixes a contrast failure |
| Teal marks on light | `#00BBC9` focus ring and bars (1.8:1 on canvas) | `teal-mark` `#00838c` (above 3:1) | Fixes a contrast failure |
| Canvas, light | `#E0E0E1` | `paper` `#EBEBEB` | The logo's own grey |
| Type | Roboto only | Roboto for titles and score, Instrument Sans for text, JetBrains Mono for labels | Keeps the familiar face for titles and score; mono for the machine layer (a deliberate change to the "no mono in interface" rule) |
| Radii | 14 / 10 | 22 bubble, 18 card, 12 control, 4 tail | Rounder, from the robot head and the bubble tail |

Not covered: admin pages (owner-only, desktop-only), the date-range picker, profile forms, and the statistics charts. They would take the same tokens.
