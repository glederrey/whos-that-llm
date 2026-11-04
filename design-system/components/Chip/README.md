# Chip
Small labels: game mode and difficulty pills, rank chips, the You tag, keyboard hints and the segmented period switch.

**Consumer provides:** the text; for difficulty, the class `wl-diff-<level>` and a `wl-dot` span.

- Difficulty is a dot plus the word, never a colored edge or a color alone. The word uses `<level>-text`; the dot uses the fill (`easy`, `medium`, `hard`, `impossible`).
- `wl-pill[aria-pressed=true]` is the selected filter: `text` fill on `canvas` text, which inverts per theme.
- `wl-rank` sets numbers in mono; medals use `gold`, `silver`, `bronze` with their `on-` text. Ranks after 3 stay plain `mute`.
- `wl-you` is the only teal chip; it marks the player's own row.
- `wl-seg` switches a period or a view (Week, Month, All time). Up to four options; more becomes a menu.
