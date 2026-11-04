# ScoreCard
The result of a round on a slab of `hidden` (a white card in light, the logo's ink bubble in dark) with a giant score in `link-on-hidden`.

**Consumer provides:** the outcome line, the score, the revealed model and its logo, the breakdown rows, and the actions.

- The score uses the `score` text style (display, 112px, tabular). On phones drop to 80px.
- The slab is rounded on all four corners; the tail corner stays on chat bubbles only.
- A round with no score (given up, missed) shows **No score** in `on-hidden-mute` at a smaller size; an Origin round without a guess shows **No guess** the same way.
- Breakdown rows are plain text left, mono figures right, hairlines in `line` (16% paper in dark). The change column is `on-hidden-mute`.
- Difficulty words on the slab take `--diff-text` for the current theme.
- The share card image (`/r/<id>/card.png`, 1080×1350) follows the same slab, white in light and ink in dark, with a 28px status chip: score in Roboto 700 and `link-on-hidden`, mono labels and figures, Instrument Sans for the rest, inside the teal frame.
- Actions: Play again (`wl-btn`) and Share (`wl-btn-quiet`). A given-up round shows **No score** and the status chip **Given up**; a failed round shows its score with **Failed**. No red slab.
