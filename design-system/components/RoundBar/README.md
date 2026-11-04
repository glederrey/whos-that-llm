# RoundBar
The strip above a round: mode, date and how many messages are left, as ten antenna dots.

**Consumer provides:** the mode label, an optional title, the current message number and the total (10).

- Each pip is one message. Sent messages fill with `teal-mark`; the current one is a ring on `hit-wash`; the rest are empty `control-line` rings. Shape, not only color, tells them apart.
- The pip row carries `role="img"` and an `aria-label` like "Message 4 of 10"; the mono label repeats it in words.
- On phones drop the title and keep the mode label and the pips on one line.
