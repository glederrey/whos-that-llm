# Pages

Signed-in pages redirect to `/login` when there is no session, then to `/welcome` when `profiles.username` is null. The landing page and `/login` are the exceptions. Transcripts of other people are never shown.

The words below are the copy. Change them here before changing them in components, so the rules page and the round cannot drift.

## Theme

Light and dark are both first-class. The first visit follows the phone or the computer (`prefers-color-scheme`). A control in the header switches them and stores the choice in the browser, so it survives a refresh and applies on the landing page before anyone is signed in. It is not a column on the profile.

Same layout in both themes. Text, chips, and the guess list stay readable. A correct chip and a missed chip stay distinguishable without relying on color alone.

The brand is three flat colors, taken from the logo. No fourth brand hue, and no gradient on the mark. The teal in the file is `#00BBC9`. Ink and paper sit the same distance off pure black and pure white.

| Token | Hex | Use |
|---|---|---|
| Ink | `#141414` | The logo ground. Text on light surfaces |
| Paper | `#EBEBEB` | The question mark. Text on dark surfaces. Cards in the light theme |
| Teal | `#00BBC9` | The dot. The one accent: links, the current score, a matched chip, the primary button |
| Teal press | `#008F99` | Hover and pressed, same hue, darker |
| Teal wash | `#E6F8F8` / `#062E2E` | A matched chip background, light theme then dark theme |
| Canvas light | `#E0E0E1` | Page background, light theme |
| Canvas dark | `#141414` | Page background, dark theme. A step off pure black so a light card can lift |
| Card dark | `#1E1E1E` | Panels on the dark canvas |
| Mute | `#52525B` / `#A1A1AA` | Secondary text, light theme then dark theme |
| Miss | `#FF4436` | The word **Wrong**, and a small dot. RGB inverse of the teal (`255 − 0`, `255 − 187`, `255 − 201`) |
| Miss press | `#C41B15` | That same red, darker, for the word on a light surface. `#FF4436` on paper is too faint at small size |
| Miss wash | `#FDECEC` / `#3A1212` | A missed chip background, light theme then dark theme |

`#FF4436` stays off the logo and off big fills. Full teal against full red buzzes. The chip still says **Wrong**, so the state is not carried by color alone.

On a light page the mark flips: black question mark, the same teal dot, paper behind it. The dot does not change between themes. At full size the period is a robot head the size of that dot: a small rounded square, square eyes, a straight mouth, no antenna. A round face reads as a person, and the LLM joke disappears. The head does not grow into a body under the question mark. The favicon keeps the plain teal dot. At 16 pixels the eyes turn the period into a broken mark.

## Phones

The same site, in the browser. There is no separate app.

A narrow screen stacks the round: header, transcript, input, then the chip board. A wide screen puts the chips on the right. Buttons and list rows are large enough to tap. The message field stays visible when the keyboard is open. The guess search is a normal text field, not a hover menu. Leaderboard and admin tables scroll sideways rather than squeezing the words off the screen.

Admin is usable on a phone and comfortable on a computer. Playing a round is the flow that has to feel good in one hand.

## Landing (`/`)

Purpose: explain the game in one screen.

- Title: **Who's that LLM**
- Line: **Five messages. One hidden model. Name it.**
- Limits, one line: **5 messages · 1 guess each · 10 games an hour**
- Button: **Play**. Goes to `/login`, or `/play` when a session exists.
- Link: **Rules**
- Daily block: **Today's model is live.** Button **Play today's**. The name is absent.
- Weekly top 5 of the daily. If the list is empty: **No one has solved today's model yet.**

## Login (`/login`)

One card, two tabs: **Sign in** and **Create account**.

- Button: **Continue with Google**
- Fields: email, password
- Create-account note: **We email you a confirmation link.**
- Link: **Forgot password**
- Errors, under the form, one at a time:
  - **Wrong email or password.**
  - **Confirm your email, then come back.**
  - **That email is already registered.**
  - **Google sign-in was cancelled.**

## Username (`/welcome`)

Shown once.

- **Pick a username. This is the name on the leaderboard.**
- Field, placeholder `ada`
- Live check: **Available** or **Taken**
- Button: **Save**
- Shape error: **3 to 20 letters, numbers, or underscores.**

## Lobby (`/play`)

- **5 messages per game**
- **4 of 10 this hour.** When the cap is full, cards disable and the line becomes **Next game at 14:22.** The time is `oldest started_at in the window + 1 hour`, in the viewer's local zone. The server compares in UTC.
- An active round replaces the cards with **Continue your game.**
- Category cards, in `sort_order`, only where `categories.enabled`. Each card is the name, the blurb, and **Play**. Disabled when the pool cannot be formed, with **Not enough models.** When the game is paused, every card is disabled and the lobby says **The game is paused.**
- Checkbox, off by default: **Play without hints.** On a scored card the subline is **No reveals. Score × 1.25.** On an unscored card it is **No reveals.**
- Links: **Rules**, **Leaderboard**, **Profile**. **Admin** only when the server has already decided this session is the admin email. It is not in the markup otherwise.

The blurbs are the `categories.blurb` column. The seed for the built-ins:

| Card | Sentence |
|---|---|
| All models | Any model in the roster. |
| Company | You already know the lab. |
| Family | Opus against Opus. The hard one. |
| Region | American, European, or Chinese. |
| Size | Small, medium, or large. |
| Latest | Only the current models. |
| Daily | Same model for everyone today. |
| Origin | Three buttons. Name the region. |
| Custom | Pick the models yourself. No score. |

All models, Daily, and Origin start on click. Custom goes to `/play/custom`. Company, Family, Region, Size, and Latest go to `/play/new?category=…`. A pool category starts on click. The player is not shown its members. The checkbox travels as `blind=1` and remains editable until Start.

## Pool picker (`/play/new`)

Heading is the category name. The list is legal pools only.

Each row: pool name, model count, button **Start**. The row does not list model names. A count under 4 adds **Small set.**

Empty state: **Nothing to play in this category yet.** Link back to the lobby.

The blind checkbox is on this page too.

Start calls `POST /api/games` and routes to `/play/[gameId]`. Failures, on this page and on Custom:

- **You already have a game open.** Link: **Continue**
- **Hourly limit reached. Next game at 14:22.**
- **You already played today's model.** Only the daily card can produce this.

## Custom (`/play/custom`)

This page lists models. The pool picker must not.

- Line under the title: **Not scored. Not on the leaderboard. Still counts toward your 10 games this hour.**
- Search, then the enabled roster grouped by company. Each row is a checkbox, the logo, the model name.
- A strip of the checked models, each with a remove control. **3 selected.**
- **Start** stays disabled below 2.
- The blind checkbox is here, worded **Play without hints.** No mention of the multiplier.

Start calls `POST /api/games` with those ids. One of them is drawn. The guess list for the round is only that set.

## Round (`/play/[gameId]`)

Three zones. On a phone the chip board sits under the transcript, as in [Phones](#phones). On a wide screen it sits on the right.

### Header

Always visible.

- `Message 2 of 5`. Before the first send: `Message 1 of 5` with the input empty, so the cap is there before they type.
- Pool label: `All models`, `Family · Opus`, `Company · Anthropic`, `Daily`, `Origin`, `Custom · 4 models`
- **Blind** when the box was checked
- On a scored round: banked score, label **Score**, and **Name it now: +700** while a guess is open
- On a custom round those two are absent. A tag reads **Not scored**
- **Give up**. Scored rounds ask **End the round? You keep the points you already have.** Custom asks **End the round?** Buttons **Keep playing** and **Give up** either way.

### Transcript

User and assistant bubbles. The system prompt is never rendered. The assistant bubble shows a typing state while the reply streams.

Input under the transcript:

- Placeholder: **Ask something**
- Counter: `120 / 500`
- Enter sends. Shift+Enter inserts a newline.
- Disabled while a reply streams, while a guess is open, at five messages, or when the round is over.
- Empty and whitespace-only sends are ignored.

### Guess bar

Appears when `awaitingGuess` is true. Heading: **Guess for message 2.**

Search field, placeholder **Search models**. Rows: logo, model name, company name. Submit is enabled when a row is selected. Button **Skip**.

Origin replaces the search with **American**, **European**, **Chinese**. One of them is the submit. **Skip** stays.

A conflict the client failed to hide: **That model doesn't fit what you already know.**

### Chip board

Seven rows, always, in the order company, family, region, size, weights, year, reasoning.

| Status | What the row shows |
|---|---|
| Given | Label, value, tag **Known** |
| Matched | Label, value, and on a scored round `+200` the first time |
| Revealed | Label, value, tag **Revealed**. Scored rounds also show the cost in red |
| Miss | Label, **Wrong**. Year miss: **Newer than your guess** or **Older than your guess**. Button **Reveal · −250** on a scored round, **Reveal** on a custom round, hidden when blind |
| Unknown | Label, an em dash. This is the state before the first guess, for chips that are not given |

Reveal asks nothing extra. One click. The button disables until the response returns.

### Failures on the round

- Model call failed, not a spend cap: **The reply failed. Send it again.** The draft stays in the input. The message was not counted.
- OpenRouter 402 or key cap: **The game is paused. Try again later.** The draft stays. The message was not counted.
- Lost the session: redirect to `/login`, then back to this round.

## Result (`/play/[gameId]/result`)

Only for `solved`, `finished`, and `given_up`. An active round redirects to the round page. Refresh is safe.

- Logo, model name, company, the seven values
- Status line: **Solved on message 2.** or **Not solved.** or **Given up.**
- On a scored round: the score, then the breakdown, one line per event, in order: matches, reveals, jackpot, blind multiplier, floor if raw was negative (**Raised to 0**)
- On a custom round, instead of the score: **Not scored. This round is not on the leaderboard.** The chips still show what was right and what was revealed. No point numbers.
- The transcript
- **Play again** returns to the lobby with that category selected. It does not start a round. Custom returns to `/play/custom` with nothing pre-checked.
- **Leaderboard**, hidden on a custom result

Daily, once at least one player has finished: **41% solved it today.**

## Leaderboard (`/leaderboard`)

Tabs are the scored categories that have at least one finished round, built-in or pool. A card you turned off still has a tab when it has history. Unscored categories, including Custom, are not tabs. A second switch: **This week** and **All time**. Weeks start Monday 00:00 UTC. The tab label says **This week (UTC)**.

Any finished scored round puts the player on that tab. Rank is the average score, highest first. Ties break by solved %, then by games played, then by username.

| Column | Meaning |
|---|---|
| Rank | Position by average points |
| Player | Current username |
| Games | Finished rounds on this tab |
| Average | Mean score, rounded to the nearest point |
| Solved | Share of those games with status `solved` |
| Msgs to solve | Mean messages on solved games only. Blank when they have not solved one |

The total is left off. Games and the average already say it, and a total rewards whoever played the most rather than who played well.

Empty: **No finished games on this board yet.**

## Profile (`/me`)

- Username, editable, same rules as `/welcome`
- **4 of 10 this hour**
- Per scored category: games, solved %, average score, average messages to solve. Custom is a separate line with games and solved % only.
- History, newest first: date, category, pool, model name, status, score. Custom shows a dash for the score. The model name is present because the round is over. A row opens its result page.
- **Sign out**

## Rules (`/rules`)

Rendered from the same config module as the server. It shows the three limits, the 500 character cap, the characteristic table (points and reveal costs), the jackpot schedule, the category multipliers, the blind multiplier, and the floor at 0. It says a miss still scores the characteristics that were right. It says Custom, and any other unscored category, is the same game with no score and no leaderboard row. It says chats are stored with the guess.

Do not hand-write the numbers in the component.
