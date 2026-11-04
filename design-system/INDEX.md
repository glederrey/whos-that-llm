# Design system

A copy of the design system artifact: https://claude.ai/artifact/PRDFCRE2Ph5qnpFFgvmC9j (private to the owner).

- `README.md`: principles, voice, color, type, shape, motion, icons.
- `tokens.json`: every token with its light and dark value and where it is used.
- `changes.md`: what the redesign changed from the earlier site, and why.
- `components/`: one folder per component, a `README.md` (usage rules) and a `preview.html` (markup that uses `components/bundle.css`). The previews are rendered by the artifact; opened on their own they lack the token variables.
- `design-system.json`: the artifact's manifest.

The app does not import anything from this folder. The code follows `app/globals.css` and `DESIGN.md`. When one of them changes, update this folder and the artifact in the same pass.
