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
  canvas: "#E0E0E1"
  card: "#FFFFFF"
  soft: "#F3F3F4"
  text: "#141414"
  mute: "#52525B"
  miss: "#FF4436"
  miss-press: "#C41B15"
  miss-wash: "#FDECEC"
  line: "#D4D4D8"
  line-strong: "#B4B4BA"
typography:
  sans:
    fontFamily: Roboto
rounded:
  base: 14px
  sm: 10px
---

## Overview

Who's that LLM? is a chat game. The player should see the game, not a generated marketing page: neat, simple, flat. Light and dark themes are both first-class and share one layout. Phone and desktop are equally important; the round must feel good in one hand.

## Colors

The brand is three flat colors taken from the logo: ink, paper and teal. There is no fourth brand hue. Teal is the one accent: links, the primary button, the score on a result and a matched trait. It marks the next action and is never a wash across a page.

The default values above are the light theme. `canvas` is the page background; `card` is the surface for panels, which lift off the canvas. `text` and `mute` are primary and secondary text. `teal-press` is for links and hover, and for small teal text on a light surface. `miss` is the word "Wrong" and a small dot; `miss-press` is that red on a light surface, where `miss` is too faint at small size. `miss-wash` and `teal-wash` are the backgrounds of a missed and a matched trait.

A match and a miss must stay distinguishable without relying on color alone.

### Difficulty scale

Easy, Medium, Hard and Impossible each have a hue that is a semantic scale, not brand color: green, amber, red and violet. The hue paints the 4px edge of a difficulty row, a selected tab and the leaderboard chip. Text in that hue uses a separate `--diff-text` token, darker in the light theme and lighter in the dark theme, so it reaches 4.5:1 on `canvas`, `card` and `soft`.

| Difficulty | Fill (`--diff`) | Text, light | Text, dark |
|---|---|---|---|
| Easy | #1C7C43 | #16703B | #3FB36B |
| Medium | #D4A017 | #7D5C00 | #D4A017 |
| Hard | #C41B15 | #C41B15 | #FF6B62 |
| Impossible | #A78BFA | #6240C9 | #A78BFA |

Never use the fill as text on a light surface, and never put the difficulty hues on a large area.

## Themes

The theme is switched with the `data-theme` attribute on `html`. The first visit follows `prefers-color-scheme`; the choice is stored in the browser.

| Token | Light | Dark |
|---|---|---|
| teal-press | #006C74 | #008F99 |
| teal-wash | #E6F8F8 | #062E2E |
| canvas | #E0E0E1 | #141414 |
| card | #FFFFFF | #1E1E1E |
| soft | #F3F3F4 | #262626 |
| text | #141414 | #EBEBEB |
| mute | #52525B | #A1A1AA |
| miss-wash | #FDECEC | #3A1212 |
| line | #D4D4D8 | #2E2E2E |
| line-strong | #B4B4BA | #4A4A4A |

`ink`, `paper`, `teal`, `miss` and `miss-press` do not change between themes.

## Typography

One typeface: Roboto, Latin subset, vendored with the site. Headings inherit it. Do not load a font from Google Fonts.

## Layout

Content width is `min(980px, 100% - 32px)` for the header, the page and the footer, and `100% - 24px` on phones. On a narrow screen the round stacks: header, transcript, input, then feedback and hints. On a wide screen feedback and hints sit in a right column. From 560px to 990px the header nav shows icons only so the bar stays on one row; under 560px the five links and the account part share one menu button, so the site name always shows. The page runs under the notch (`viewport-fit=cover`) and the shell pads itself back out with `env(safe-area-inset-*)`. The browser bar color follows the system scheme until the player picks a theme by hand. Tables scroll sideways on a phone instead of squeezing their words.

## Elevation & Depth

Cards and message bubbles use a faint shadow in the light theme and none in the dark theme. Menus and dialogs use a larger lift shadow in both themes.

## Shapes

Corners stay slight. `base` is for cards, menus and the composer; `sm` is for buttons and inputs. Pills are fully rounded.

## Do's and Don'ts

- Don't use gradient fills, glass, blur or a glow behind the logo.
- Don't add a fourth brand hue or a gradient on the logo mark.
- Don't put `miss` on the logo or on large fills; full teal against full red buzzes.
- Don't add decorative loops, a bouncing logo or an animated background. Motion stays small: a reply arriving word by word, waiting dots, a trait chip unveiling, a short shake on a wrong guess.
- Don't build the landing page as a feature grid, quotes or a logo wall.
- Don't edit, flip or redraw the logo files, and never use the `_dot` favicon files. Use `tail_right` when the title is to the right of the mark and `tail_left` when it is to the left; leave the mark out where no text sits beside it.
