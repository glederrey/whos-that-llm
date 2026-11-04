---
version: alpha
name: Who's that LLM?
description: A chat game where the player guesses which hidden model they are talking to.
colors:
  ink: "#141414"
  paper: "#EBEBEB"
  teal: "#00BBC9"
  teal-press: "#006C74"
  teal-wash: "#E6F8F8"
  canvas: "#EBEBEB"
  card: "#FFFFFF"
  soft: "#F4F4F5"
  text: "#141414"
  mute: "#55555C"
  miss: "#FF4436"
  miss-press: "#C41B15"
  miss-wash: "#FDECEC"
  line: "#D4D4D8"
  line-strong: "#B4B4BA"
  control-line: "#86868E"
  bubble: "#F6F6F7"
  on: "#1C7C43"
  on-press: "#166537"
  off-press: "#9E1510"
  hidden: "#FFFFFF"
  on-hidden: "#141414"
  link-on-hidden: "#00838C"
  reply: "#DEDEE2"
  on-reply: "#141414"
  link-on-reply: "#006C74"
  player: "#D6F3F5"
  teal-mark: "#00838C"
  hit-wash: "#D6F3F5"
typography:
  display:
    fontFamily: Roboto
  sans:
    fontFamily: Instrument Sans
  mono:
    fontFamily: JetBrains Mono
rounded:
  base: 18px
  sm: 12px
  bubble: 22px
  tail: 4px
---

## Overview

The full design system (every token's usage, component rules and previews) is in `design-system/`; start at `design-system/INDEX.md`. This file is the short version the code follows.

Who's that LLM? is a chat game. The player should see the game, not a generated marketing page: neat, simple, flat. The look comes from the logo itself: the hidden model speaks from a bubble with the logo's tail, messages are counted in the robot's antenna dots, and buttons are keys with a hard edge. Light and dark themes are both first-class and share one layout. Phone and desktop are equally important; the round must feel good in one hand.

## Colors

The brand is three flat colors taken from the logo: ink, paper and teal. There is no fourth brand hue. Teal is the one accent: links, the primary button, the score on a result and a matched trait. It marks the next action and is never a wash across a page.

The default values above are the light theme. `hidden` is the score slab on a result: a white card in light, the logo's ink bubble (a raised grey) in dark, with `on-hidden` text and `link-on-hidden` for the score (`#00838C` in light, since `teal` is 2.2:1 on white). Links on the slab use `teal-text`. `reply` is the hidden model's bubble: a grey a step off the canvas (`#DEDEE2` with `on-reply` ink text in light, `#262626` with paper text in dark), with `link-on-reply` for links. `player` is the pale teal of the player's own bubbles. `teal-mark` is teal as a thin mark (message dots, the focus ring, check icons) on light grounds, where `teal` is under 3:1; `teal` stays a fill. `hit-wash` is the ground of a found trait. `canvas` is the page background; `card` is the surface for panels, which lift off the canvas. `text` and `mute` are primary and secondary text. `teal-press` is for links and hover, and for small teal text on a light surface. `miss` is the word "Wrong" and a small dot; `miss-press` is that red on a light surface, where `miss` is too faint at small size. `miss-wash` and `teal-wash` are the backgrounds of a missed and a matched trait.

A match and a miss must stay distinguishable without relying on color alone.

### Difficulty scale

Easy, Medium, Hard and Impossible each have a hue that is a semantic scale, not brand color: green, yellow, red and violet. The hue paints a dot before the difficulty word: 10px on a lobby row, 8px on a leaderboard or history row (the word takes `--diff-text`, no fill). Text in that hue uses a separate `--diff-text` token, darker in the light theme and lighter in the dark theme, so it reaches 4.5:1 on `canvas`, `card` and `soft`.

| Difficulty | Fill (`--diff`) | Text, light | Text, dark |
|---|---|---|---|
| Easy | #1C7C43 | #0E5A2C | #3FB36B |
| Medium | #F5C518 | #7A5C00 | #F5C518 |
| Hard | #C41B15 | #B01711 | #FF6B62 |
| Impossible | #A78BFA | #4E2FB0 | #A78BFA |

A selected difficulty tab is filled; the Impossible tab uses `#7C5CE6` with white text, in both themes.

On the score slab, difficulty words take `--diff-text` like anywhere else (the card image does the same: light colors on its white slab, dark on its dark one).

Never use the fill as text on a light surface, and never put the difficulty hues on a large area.

## Themes

The theme is switched with the `data-theme` attribute on `html`. The first visit follows `prefers-color-scheme`; the choice is stored in the browser.

| Token | Light | Dark |
|---|---|---|
| teal-press | #006C74 | #008F99 |
| teal-wash | #E6F8F8 | #062E2E |
| canvas | #EBEBEB | #0F0F0F |
| card | #FFFFFF | #1A1A1A |
| soft | #F4F4F5 | #232323 |
| text | #141414 | #EBEBEB |
| mute | #55555C | #A1A1AA |
| miss-wash | #FDECEC | #3A1212 |
| line | #D4D4D8 | #2E2E2E |
| line-strong | #B4B4BA | #4A4A4A |
| control-line | #86868E | #76767E |
| bubble | #F6F6F7 | the card |
| hidden | #FFFFFF | #262626 |
| on-hidden | #141414 | #EBEBEB |
| on-hidden-mute | #55555C | #A1A1AA |
| link-on-hidden | #00838C | #33CCD8 |
| reply | #DEDEE2 | #262626 |
| on-reply | #141414 | #EBEBEB |
| link-on-reply | #006C74 | #33CCD8 |
| player | #D6F3F5 | #0B3A3E |
| teal-mark | #00838C | #00BBC9 |
| teal-text | #006C74 | #33CCD8 |
| hit-wash | #D6F3F5 | #062E2E |

`ink`, `paper`, `teal`, `miss` and `miss-press` do not change between themes. Red text uses `miss-text`, which is `miss-press` in light and a lighter `#FF6B5E` in dark (5.6:1 on the dark card); `miss-press` stays the fill behind white text.

## Typography

Three families, each with one job, all Latin subsets vendored as woff2 in `app/fonts` (OFL) and loaded with `next/font/local`. Do not load a font from Google Fonts.

- Roboto (variable, 700 for headings, 900 for the score) for headings and the score (`--font-display`).
- Instrument Sans for everything people read: the player's messages, body, buttons (`--font`, `--font-bold`).
- JetBrains Mono (500, 700 for bold in a reply) for the machine layer: the hidden model's replies, the message counter, trait names, table heads, score breakdown figures, ranks and character counts, as small uppercase labels or figures (`--font-mono`). Code in rendered markdown is mono too.

The hidden model types in mono at 15px (it runs wider than sans); the player writes in Instrument Sans, so the two voices differ in face as well as color. The share card image (`app/r/[gameId]/card.png`) uses the same three families.

## Layout

Content width is `min(980px, 100% - 32px)` for the header, the page and the footer, and `100% - 24px` on phones. On a narrow screen the round stacks: header, transcript, input, then feedback and hints. On a wide screen feedback and hints sit in a right column. From 560px to 990px the header nav shows icons only so the bar stays on one row; under 560px the six links (Play first) and the account part share one menu button, so the site name always shows. The page runs under the notch (`viewport-fit=cover`) and the shell pads itself back out with `env(safe-area-inset-*)`. The browser bar color follows the system scheme until the player picks a theme by hand. Tables scroll sideways on a phone instead of squeezing their words.

## Elevation & Depth

`control-line` is the border of inputs and the message box: at least 3:1 against the card, so a field is visible without its fill. `bubble` is a light neutral for panels like the example round's frame; it is not a new brand hue. Cards and message bubbles use a faint shadow in the light theme and none in the dark theme. Menus and dialogs use a larger lift shadow in both themes.

## Shapes

`base` (18px) is for cards, menus and the composer; `sm` (12px, the robot's head) is for buttons and inputs. Bubbles are `bubble` (22px) with one `tail` (4px) corner on the speaker's side: bottom-left for the hidden model, bottom-right for the player. The score slab has no tail: all four corners are `base`. Pills and message dots are fully rounded.

## Buttons

Radius `sm`, flat fills, no gradient. Buttons are keys: a hard bottom edge (`0 3px 0 teal-press` on primary, `0 2px 0 control-line` on quiet) that goes away with a small travel on press. Primary is teal with a near-black text (`#062e2e`, a dark teal, not `ink`); hover on the primary deepens the teal a step (`#01A4B0`, teal mixed 16% toward its label color) and keeps the dark-teal label, 4.8:1; it never flips to ink, paper or white. Quiet is `card` with a `control-line` border (3.6:1 on the card in light, 3.7:1 in dark) and `text` label. Give up is quiet with `miss-press` text, no border and no edge. On/off are `on` (green) and `miss-press` fills with white text; hover darkens to `on-press` and `off-press`. Hover is gated behind `(hover: hover)`. Targets are 44px on phones.

## Do's and Don'ts

- Don't use gradient fills, glass, blur or a glow behind the logo. A gradient is allowed only as a functional fade: scroll shadows on tables and the fade under the sticky message bar on a phone.
- Don't add a fourth brand hue or a gradient on the logo mark.
- Don't put `miss` on the logo or on large fills; full teal against full red buzzes.
- Don't add decorative loops, a bouncing logo or an animated background. The home page has two exceptions, and both stop under reduced motion: the example round and the slow company strip. Motion stays small: a reply arriving word by word, waiting dots, a trait tile unveiling, a short shake on a wrong guess. Pages settle in with a 6px rise and fade (0.22s), the account menu opens from its button (0.14s), and tabs give a little on press. All of it stops under reduced motion.
- Don't build the landing page as a feature grid, quotes or a logo wall. The home hero is the title (**Guess the hidden AI.**) with the logo tail pointing at the word AI, one paragraph, one primary button and an example round. The only list below it is the company strip and the Top 5. It has no card of steps.
- Don't edit, flip or redraw the logo files, and never use the `_dot` favicon files. The only cut-out is the robot (`bot-ink-eyes.png`, `bot-paper-eyes.png`), taken unchanged from the logo files with the background removed. Use `tail_right` when the title is to the right of the mark and `tail_left` when it is to the left; leave the mark out where no text sits beside it.

## Round

- The message bar shows ten dots: sent filled with `teal-mark`, current a ring on `hit-wash`, the rest empty.
- The hidden model's replies sit in `reply` with a "Hidden model" label and the logo's robot above (`public/brand/bot-ink-eyes.png` in light, `bot-paper-eyes.png` in dark, 20px tall: the head, about one text line high, is centered on the label's capitals, and the antennas rise above the line into the gap before the reply); the player's in `player`.
- Traits are a 2×2 grid of tiles: dashed when unknown, `hit-wash` with a check when found, a cross when missed. An unknown tile shows only its Reveal button when one is for sale, else **Not found yet**. A found company shows its logo before the name, as Origin shows its flag.
- The result's score card is the `hidden` slab (a white card with the usual border and shadow in light, ink with none in dark) with the score in Roboto 900 and `link-on-hidden`. A round with no score (given up, missed) shows the words **No score** in `on-hidden-mute`, smaller (Roboto 700); an Origin round without a guess shows **No guess** the same way. A result with no message hides **The chat**.
