# Button
An arcade key: a flat fill with a hard bottom edge that disappears when pressed.

**Consumer provides:** a `<button>` or `<a>` with class `wl-btn`, plus one modifier, and a label of one to three words. An icon is optional, 18px, before the label.

| Class | Use | Look |
|---|---|---|
| `wl-btn` | The one next action on a screen: Play, Guess, Send, Play again | `teal` fill, `on-teal` label, `shadow-press` edge |
| `wl-btn-lg` | Add to `wl-btn` for the home hero only | 52px tall |
| `wl-btn-quiet` | Secondary actions: Next message, Share, Cancel | `surface`, `control-line` border, `shadow-press-quiet` |
| `wl-btn-giveup` | Give up inside the composer | text only in `miss-text`, `miss-wash` on hover |
| `wl-btn-danger` | Confirm a destructive step in a dialog | `miss-fill`, `on-fill` label |

- Press: the button travels 3px down and loses its edge in `t-press`. Hover (only where hover exists) deepens the primary teal a step (`#01A4B0`) and keeps its dark-teal label, in both themes. It never flips to ink or paper.
- One `wl-btn` per view. Two teal keys side by side means one of them is quiet.
- 44px minimum height everywhere; full width on phones at the bottom of a round.
- Never white text on `teal`. Never a gradient or glow.
