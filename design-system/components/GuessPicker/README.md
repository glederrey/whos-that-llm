# GuessPicker
The search field and list the player uses to name a model.

**Consumer provides:** the query, the filtered models (name, company, year, logo) and the selected index.

- Field: 44px, `control-line` border, search icon in `mute`. The list floats on `surface` with `shadow-lift`.
- Options show the company logo in a 28px rounded square, the model name in `body-strong` and company plus year in `small`, `mute`.
- Arrow keys move `aria-selected`; the selected row shows a `wl-kbd` Enter hint.
- The list never shows models outside the round's pool.
