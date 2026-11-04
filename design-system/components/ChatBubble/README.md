# ChatBubble
The transcript. The hidden model speaks from the logo's black bubble; the player answers in teal-wash.

**Consumer provides:** the role (`hidden` or `player`), the message text or rendered markdown, and for the hidden model an optional meta line (turn, tokens).

- `wl-bubble-hidden`: `hidden` ground (ink in light, `#262626` in dark), `on-hidden` text, links and inline code in `link-on-hidden`. Its bottom-left corner is `radius-tail`, the logo's tail.
- `wl-bubble-player`: `player` ground, `on-player` text, the tail corner bottom-right.
- Above the hidden bubble sits the speaker line: the small teal robot (`wl-bot`) and the label "Hidden model". Never the model's name or company logo during a round.
- Bubbles cap at 72% of the column (620px). Code blocks scroll sideways inside the bubble.
- Waiting: `wl-typing` inside a hidden bubble, three dots that blink. Replies stream word by word into the same bubble.
