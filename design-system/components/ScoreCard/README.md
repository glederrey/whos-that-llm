# ScoreCard
The result of a round, set in the logo's bubble: a slab of `hidden` with a giant score in `link-on-hidden`.

**Consumer provides:** the outcome line, the score, the revealed model and its logo, the breakdown rows, and the actions.

- The score uses the `score` text style (display, 112px, tabular). On phones drop to 80px.
- The slab keeps the tail corner bottom-left, like a hidden-model bubble: the model's last word.
- Breakdown rows are plain text left, mono figures right, hairlines at 16% paper.
- Actions: Play again (`wl-btn`) and Share (`wl-btn-quiet`). A gave-up or failed round shows the model and 0 with the label "Gave up" or "Out of messages"; no red slab.
