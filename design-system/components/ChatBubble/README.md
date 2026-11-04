# ChatBubble
The transcript. The hidden model speaks from a grey bubble with the logo's tail; the player answers in teal-wash.

**Consumer provides:** the role (`hidden` or `player`), the message text or rendered markdown, and for the hidden model an optional meta line (turn, tokens).

- `wl-bubble-hidden`: `reply` ground (`#DEDEE2` in light, `#262626` in dark), `on-reply` text, links in `link-on-reply`. Its bottom-left corner is `radius-tail`, the logo's tail.
- `wl-bubble-player`: `player` ground, `on-player` text, the tail corner bottom-right.
- Above the hidden bubble sits the speaker line: the small teal robot (`wl-bot`) and the label "Hidden model". Never the model's name or company logo during a round.
- Bubbles cap at 72% of the column (620px). Code blocks scroll sideways inside the bubble.
- Waiting: `wl-typing` inside a hidden bubble, three dots that blink. Replies stream word by word into the same bubble.
