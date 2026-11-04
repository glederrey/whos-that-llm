Who's that LLM? is a chat game: a hidden model answers, the player has ten messages to name it. The design comes from the logo itself. The hidden model speaks from the logo's black bubble, messages are counted in the robot's antenna dots, and every control is the robot's rounded square. Ink, paper and teal stay the only brand colors; the game gets its character from shape, type and one big number at the end.

## Principles

- **The chat is the game.** Every screen of a round centers the transcript. Side panels (evidence, the guess picker) support it and never compete with it.
- **The hidden model is the black bubble.** Only the hidden model's replies and the result slab use `hidden`. Nothing else on a page is ink-filled, so the eye always finds the suspect.
- **Count, don't decorate.** The only recurring ornament is the row of ten pips. It is information: messages used and left.
- **Same game on phone and desktop.** Phone and desktop get the same parts, stacked or side by side. Targets are 44px.
- **Honest limits.** Messages left, characters left, games per hour and a paused game are always shown in plain words in the mono `label` style.

## Voice and copy

- Address the player as "you"; the game never speaks as "we". Short, plain sentences, a little playful: "Who is behind the bubble?", "You got it.", "Out of messages."
- Sentence case everywhere, including buttons: "Play today's round", "Give up", "Share result".
- Name the hidden model "Hidden model" until the round ends. Never hint at its name, company or logo in copy, alt text or color.
- Numbers are figures: "4 messages", "500 characters", "×1.5". Thin space between thousands in scores: "1 240".
- No emoji in interface copy. Players may use emoji in their own messages and usernames.

## Color

- Light theme: `canvas` is the logo's `paper`, `surface` is white for cards. Dark theme: `canvas` `#0f0f0f`, `surface` `#1a1a1a`.
- Body text is `text`; secondary text and every mono label is `mute`. Links and matched values are `teal-text`.
- `teal` is a fill: the primary button, the You tag, the robot. Text on it is `on-teal`, never white. As a thin mark on light grounds (pips, focus ring, check icons) use `teal-mark`, which holds 3:1.
- `hidden` carries the hidden model's bubble and the score slab: ink in light, `#262626` in dark, with `on-hidden` text and `link-on-hidden` for links and code.
- `player` (a pale teal) carries the player's own bubbles, with `on-player` text.
- A miss is `miss-text` on `miss-wash` with a cross icon; `miss` is only ever a small dot. A hit is `teal-text` on `hit-wash` with a check. Color never carries a state alone.
- Difficulty is a dot and a word: the dot uses `easy`, `medium`, `hard`, `impossible`; the word uses the matching `-text` token. Never the fill as text, never on a large area.
- Medal chips: `gold`, `silver`, `bronze` with their `on-` tokens.
- Every text pair named in a token's usage holds 4.5:1 in both themes; borders and marks that carry meaning hold 3:1.

## Type

- Three families, each with one job. `display` (Roboto, 700 and 900) for titles and the score. `sans` (Instrument Sans) for everything people read: chat, body, buttons. `mono` (JetBrains Mono) for the machine layer: the turn counter, evidence names, score breakdown figures, ranks, token counts.
- Styles: `score` for the result number only; `hero` for the home title only; `h1` page titles; `h2` card titles; `lede` the paragraph under a title, in `mute`; `body` chat and copy at 16px; `body-strong` model names and values; `small` help text; `label` mono uppercase labels; `figure` mono numbers.
- Chat bubbles are always `sans`, never mono, however technical the reply. Code inside a reply is mono.
- In the app, vendor the three fonts as woff2 with `next/font/local` (Latin subset), as Roboto is today; do not load Google Fonts at runtime.

## Shape and space

- Radii: `radius-control` (12px, the robot's head) for buttons, inputs and options; `radius-card` (18px) for cards, menus and the composer; `radius-bubble` (22px) for bubbles with one `radius-tail` (4px) corner on the speaker's side; `radius-chip` for ranks and keys; `radius-pill` for pills and pips.
- The tail corner is the speaker: bottom-left for the hidden model and the score slab, bottom-right for the player.
- Spacing steps `space-1` to `space-12` (4 to 48px). Card padding `space-5` on desktop and `space-4` on phones; turns sit `space-3` apart.
- Content width `min(1040px, 100% - 32px)`; on phones `100% - 24px`. A round puts the evidence and guess panel in a 340px right column from 900px up; below that it stacks bar, transcript, evidence, composer, then a full-width Guess button.

## Depth and motion

- Cards and bubbles take `shadow-card` in light and nothing in dark. Menus and the guess list take `shadow-lift`.
- Buttons are keys: `shadow-press` (teal-deep edge) or `shadow-press-quiet`, gone on press with a 3px travel in `t-press`.
- Focus is `focus-ring`, solid, outside the control, on every focusable element.
- Motion is small and means something: a reply streaming word by word, typing dots, an evidence tile unveiling (`t-settle`), a page rising 6px. Everything stops under reduced motion.
- No gradients, glass, blur or glow. The only gradient allowed is a functional scroll fade.

## Iconography

- Line icons at 18px, 2px stroke, round caps, `currentColor`: check, cross, send, search, the nav set. The current site draws its own inline SVGs; keep that.
- The small `wl-bot` robot (a teal rounded square with two paper eyes) marks the hidden model's speaker line and the revealed model on the score slab. It is drawn in CSS, not an image.
- Company logos appear only after a round ends and in the guess picker, inside a 28px `radius-control` tile on `surface-sunk`.
- No emoji as icons.

## Logo

The logo files are in `public/brand/` (the Logos asset group in the artifact). Use `logo-tail-right` when the name is to the right of the mark, `logo-tail-left` when it is to the left, the `-dark` files in the dark theme. Never recolor, redraw or animate the mark.
