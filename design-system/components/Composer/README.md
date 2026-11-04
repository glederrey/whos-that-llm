# Composer
The message box at the bottom of a round, with the character count, Give up and Send.

**Consumer provides:** the textarea value and handlers, characters used, messages left, and the disabled state when the round is over or the game is paused.

- Text is 16px so iOS does not zoom. Border `control-line`; focus swaps it for `focus-ring`.
- The foot holds the mono count ("0 / 500 · 7 left") on the left and Give up plus Send on the right.
- Disabled: add `is-off`; the ground drops to `surface-sunk` and the placeholder says why ("Round over", "Game paused: out of credits").
- On phones it sticks to the bottom above the safe-area inset.
