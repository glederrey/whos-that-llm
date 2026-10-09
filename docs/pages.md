# Pages

Play routes redirect to `/login` when there is no session, then to `/welcome` when `profiles.username` is null. The landing page and `/login` are the exceptions. Transcripts of other people are never shown.

There is no `/rules` page. The design doc stays private. The main page has a short explanation of each category. The only public scoring text is the short block on the result page.

The words below are the copy. Change them here before changing them in components.

The site is English. A second language waits until there is a translation to ship. Until then there is no locale prefix, no dictionary, and no translation columns. Error codes stay codes, so a later translation does not rewrite the API. The system prompt stays English and is not told a language, so the model's reply language can still be a clue.

## Theme

Light and dark are both first-class. The first visit follows the phone or the computer (`prefers-color-scheme`). A control in the header switches them and stores the choice in the browser, so it survives a refresh and applies on the landing page before anyone is signed in. It is not a column on the profile.

Same layout in both themes. Text, feedback, and the guess list stay readable. A match and a miss stay distinguishable without relying on color alone.

The brand is three flat colors, taken from the logo. No fourth brand hue, and no gradient on the mark. The teal in the file is `#00BBC9`. Ink and paper sit the same distance off pure black and pure white.

| Token | Hex | Use |
|---|---|---|
| Ink | `#141414` | The logo ground. Text on light surfaces |
| Paper | `#EBEBEB` | The question mark. Text on dark surfaces. Cards in the light theme |
| Teal | `#00BBC9` | The dot. The one accent: links, the score on the result, a matched trait, the primary button |
| Teal press | `#008F99` | Hover and pressed, same hue, darker |
| Teal wash | `#E6F8F8` / `#062E2E` | A matched trait background, light theme then dark theme |
| Canvas light | `#E0E0E1` | Page background, light theme |
| Canvas dark | `#141414` | Page background, dark theme. A step off pure black so a light card can lift |
| Card dark | `#1E1E1E` | Panels on the dark canvas |
| Mute | `#52525B` / `#A1A1AA` | Secondary text, light theme then dark theme |
| Miss | `#FF4436` | The word **Wrong**, and a small dot. RGB inverse of the teal (`255 − 0`, `255 − 187`, `255 − 201`) |
| Miss press | `#C41B15` | That same red, darker, for the word on a light surface. `#FF4436` on paper is too faint at small size |
| Miss wash | `#FDECEC` / `#3A1212` | A missed trait background, light theme then dark theme |

`#FF4436` stays off the logo and off big fills. Full teal against full red buzzes. The row still says **Wrong**, so the state is not carried by color alone.

On a light page the mark flips: black question mark, the same teal dot, paper behind it. The dot does not change between themes. At full size the period is a robot head the size of that dot: a small rounded square, square eyes, a straight mouth, no antenna. A round face reads as a person, and the LLM joke disappears. The head does not grow into a body under the question mark. The favicon keeps the plain teal dot. At 16 pixels the eyes turn the period into a broken mark.

## Look

Neat and simple. A player should see the game, not a generated marketing page.

Flat color from the palette above. No gradient fills, no glass, no blur, no glow behind the logo. One typeface. Corners stay slight. Motion is a reply arriving word by word, and a feedback row changing state.

The landing page is the title, one sentence, the limits, a short line for each category, and Play. No feature grid, no quotes, no logo wall, no animated background. Teal marks the next action. It is not a wash across the page.

The header mark follows the theme. Light theme uses `logo/light`. Dark theme uses `logo/dark`. The mark sits to the left of the name **Who's that LLM**. The favicon is the dot version. Next serves files from `public/`, so those files are copied there. The folders are named for the theme.

## Phones

The same site, in the browser. There is no separate app.

A narrow screen stacks the round: header, transcript, input, then feedback and hints. A wide screen puts feedback and hints on the right. Buttons and list rows are large enough to tap. The message field stays visible when the keyboard is open. The guess search is a normal text field, not a hover menu. Leaderboard and admin tables scroll sideways rather than squeezing the words off the screen.

Admin is usable on a phone and comfortable on a computer. Playing a round is the flow that has to feel good in one hand.

## Footer

On every page, including the round and admin.

- **Tip** opens the Ko-fi page in a new tab. The URL is `tipUrl` in `lib/config.ts`. An empty string hides the link, so the footer can ship before the page exists.
- **Created by Gael Lederrey with Cursor**, with the Cursor logo. **Gael Lederrey** links to `https://github.com/glederrey`. **Cursor** and the logo link to `https://cursor.com`.

A tip does not raise the hourly cap, change a score, or put a name on the leaderboard.

## Landing (`/`)

Purpose: explain the game in one screen. Public. Playing requires a session.

- Title: **Who's that LLM**
- Line: **Five messages. One hidden model. Name it.**
- Limits, one line: **5 messages · 1 guess each · 10 games an hour**
- Button: **Play**. Goes to `/login`, or `/play` when a session exists.
- Category lines, one sentence each, in `sort_order`. A category that is not enabled yet has **Not open yet.** and no button. The sentences are the `categories.blurb` column:

| Card | Sentence |
|---|---|
| All models | Any model in the roster. Name it, or take the region and the company. |
| Company | The lab is already known. Name the model. |
| Family | One family. Name the model. |
| Region | USA, China, or Europe. |
| Latest | The newest model in each family. |
| Daily | The same model for everyone today. |
| Origin | USA, China, or Europe. One guess. |

- Daily block, later, and only when Daily is enabled: **Today's model is live.** Button **Play today's**. The name is absent. Disabled, with **The game is paused.**, when the game is paused. No session goes to `/login` and then into today's round. An open daily round shows **Continue**. A day already started, including a give-up, shows **You already played today's model.** and does not start another.
- Weekly top 5, later: rank, name, and score from the All models board for the current week, limited to 5. Visible before login. If the week has no counted round: **No finished games this week.**

A confirmation or password-reset link returns here. If the URL carries a session and the profile has no username, send the player to `/welcome`.

## Login (`/login`)

One card, two tabs: **Sign in** and **Create account**.

- Button: **Continue with Google**
- Fields: email, password
- Create-account note: **We email you a confirmation link.**
- Link: **Forgot password**. Asks for an email. Supabase sends the reset. The page says **Check your email.** either way, so it does not reveal whether the address exists.
- The confirmation link and the reset link both open `/`.
- Errors, under the form, one at a time:
  - **Wrong email or password.**
  - **Confirm your email, then come back.**
  - **That email is already registered.**
  - **Google sign-in was cancelled.**

## Username (`/welcome`)

Shown once, when `profiles.username` is null.

- **Pick a username.**
- Field, placeholder `Human`. The field starts filled with **Human**, so Save keeps that name unless they change it.
- Button: **Save**
- Shape error: **3 to 20 characters.**
- Capitals and punctuation are allowed. Shared names are allowed. Save stores the name on that profile.
- Save goes to `/play`, or back to the play URL they were trying to open.

Changing the username, and a profile with stats and past games, come later. Do not build `/me` in the first pass.

## Lobby (`/play`)

- **5 messages per game**
- **4 of 10 this hour.** When the cap is full, cards disable and the line becomes **Next game at 14:22.** The time is `oldest started_at in the window + 1 hour`, in the viewer's local zone. The server compares in UTC.
- An active round replaces the cards with **Continue your game.**
- Category cards, in `sort_order`, only where `categories.enabled`. In the first build that is All models. Each card is the name, the blurb, and **Play**. Disabled when the pool cannot be formed, with **Not enough models.** When the game is paused, every card is disabled and the lobby says **The game is paused.**
- Checkbox, off by default: **Play without hints.** Subline: **No year or size hints. No match feedback. Score × 1.5.** The checkbox is absent on Origin. It stays editable until Start.
- Links: **Leaderboard**. **Admin** only when the server has already decided this session is the admin email, and only once admin exists. It is not in the markup otherwise.

All models starts on click. Daily, Origin, and Latest start on click when they exist. Latest draws the newest enabled model in each family and does not ask the player to pick a family. Company, Family, and Region go to `/play/new?category=…`. The checkbox travels as `noHint=1`.

## Pool picker (`/play/new`)

Later, for Company, Family, and Region. Heading is the category name. The list is legal pools only.

Each row: pool name, model count, button **Start**. The row does not list model names. A count under 4 adds **Small set.**

Region rows are labeled **USA**, **China**, and **Europe**. Latest has no picker. Its one pool is the newest enabled model in each family, and the card starts the round. Fewer than two of those models and the card says **Not enough models.**

Empty state: **Nothing to play in this category yet.** Link back to the lobby.

The no-hint checkbox is on this page too. Company and Family do not offer year and size hints, so the subline is **No match feedback. Score × 1.5.** Region keeps **No year or size hints. No match feedback. Score × 1.5.**

Start calls `POST /api/games` and routes to `/play/[gameId]`. Failures:

- **You already have a game open.** Link: **Continue**
- **Hourly limit reached. Next game at 14:22.**
- **You already played today's model.** Only the daily card can produce this.

## Round (`/play/[gameId]`)

The result is a page, not a popup. When the round ends, go to `/play/[gameId]/result`.

On a phone, feedback and hints sit under the transcript, as in [Phones](#phones). On a wide screen they sit on the right.

### Header

Always visible.

- `Message 2 of 5`. Before the first send: `Message 1 of 5` with the input empty, so the cap is there before they type.
- Pool label: `All models`, `Family · Opus`, `Company · Anthropic`, `Region · USA`, `Latest`, `Daily`, `Origin`
- **No hints** when the box was checked
- **Give up**. Asks **End the round? You will see the model. This round stays off the leaderboard.** Buttons **Keep playing** and **Give up**.

The score is not shown in the header. It is computed when the round ends.

### Transcript

User and assistant bubbles. The system prompt is never rendered. The assistant bubble streams word by word. The guess stays closed until the full reply is stored.

Input under the transcript:

- Placeholder: **Ask something**
- Counter: `120 / 500`
- Enter sends. Shift+Enter inserts a newline.
- Disabled while a reply streams, while a guess is open, at five messages, or when the round is over.
- Empty and whitespace-only sends are ignored. They do not spend a message.

A stored assistant reply that is empty or whitespace still spends the message and opens the guess. The bubble can be blank.

### Guess bar

Appears when `awaitingGuess` is true. Heading: **Guess for message 2.**

Search field, placeholder **Search models**. Rows: logo, company, and name. Nothing else. Submit is enabled when a row is selected. There is no Skip.

The list is the one the server already filtered. A guess the server rejects: **That model is not in the list.**

Origin replaces the search with **USA**, **China**, **Europe**. One tap submits the only guess of the round. Until the player taps one, or gives up, the message box stays available, up to five messages.

### Feedback

Hidden for the whole round when no-hint mode is on. Origin renders none of it.

Given traits, when the pool has any, show even in no-hint mode: label, value, tag **Known**. A given year or size is shown here and has no buy button.

After a guess, when feedback is allowed:

| Trait | Hit | Miss |
|---|---|---|
| Company | **Company · Anthropic** | **Wrong company** |
| Region | **Region · USA** | **Wrong region** |
| Family | **Same family.** | Say nothing |

Point numbers stay off this board. They are on the result page. Naming the model leaves the round before another feedback pass.

### Hints

Under the feedback, after the first reply, when this category allows hints and no-hint mode is off.

- **Year · 100 points**
- **Size · 100 points**

One click. The button disables until the response returns. A bought year shows the calendar year, such as **2026**. A bought size shows **Small**, **Medium**, or **Large**. The button does not come back. A trait the pool already shares is not listed.

### Failures on the round

- Model call failed, not a credit error: **The reply failed. Send it again.** The draft stays in the input. The message was not counted.
- OpenRouter 402 or an explicit credit error: **The game is paused. Try again later.** The draft stays. The message was not counted. Every player is paused, not only this one.
- Already paused: **The game is paused. Try again later.**
- Hint rejected: **That hint is not available.**
- Lost the session: redirect to `/login`, then back to this round.

## Result (`/play/[gameId]/result`)

A page, not a popup. Only for `solved`, `miss`, and `given_up`. An active round redirects to the round page. Refresh is safe.

- Logo, model name, company, region, family, year, and size. Origin names the model here. The round never did.
- Status line: **Solved on message 2.** or **Miss.** or **Given up. This round is not on the leaderboard.**
- The score, then the breakdown, then the short explanation. A give-up before any reply has no score and no breakdown. The status line is enough.
- The transcript
- **Play again** returns to the lobby. It does not start a round. A company, family, or region round returns to that category's pool picker. Latest returns to the lobby.
- **Leaderboard**, shown when this category has a leaderboard and the status is `solved` or `miss`

The score is the integer from [Rules](rules.md), including a negative total. There is no line that raises it to zero.

The breakdown is the lines from [Rules](rules.md), in that order, then **Total**. The parts add up to the total.

Next to the breakdown, heading **How this score works**, these lines and no others. Fill them with this round's numbers.

> Your score starts from the base, multiplies by the token factor and the message factor, then by 1.5 if you played with no hints, then subtracts 100 for each hint.

- Base: **1,000** for naming the model.
- Or, when the model was not named: **Base: 400** — region 100, company 300. Drop a trait that did not match or was given, so a region-only base reads **Base: 100** for the region, a company-only base reads **Base: 300** for the company, and nothing matched reads **Base: 0**.
- **Tokens: 500.** Token factor **1,000/500.** When the token total is 0: **Tokens: 0.** Token factor **1.**
- **Messages: 2 replies.** Message factor **5/2.**
- When no-hint mode was on: **No-hint: ×1.5.**
- **Hints: Year −100. Size −100.** When none were bought: **Hints: none.**

That block is the only scoring explanation on the site.

Daily stats, later, on a daily result, once at least one daily round has finished:

- **41% solved it.**
- **Messages: 3 used 1 reply · 10 used 2 · …**
- **55% got the company.**
- **Average tokens: 1,420.**

## Leaderboard (`/leaderboard`)

Tabs are the categories with a leaderboard that have at least one counted round. That is All models, Daily when it exists, and a main family only if that board is turned on later. A card you turned off still has a tab when it has history. Company, Region, Latest, and Origin are not tabs.

A second switch: **This week** and **All time**. Weeks start Monday 00:00 UTC. The tab label says **This week (UTC)**.

A counted round is `solved` or `miss`. Give-up does not appear. Rank is the best score, highest first. Ties break by fewer messages on that round, then by earlier finish. A negative score stays on the board.

| Column | Meaning |
|---|---|
| Rank | Position by best score |
| Name | Username copied onto that round |
| Score | That best score |

Two players may share a username. They are separate rows, because the account id is different. The page shows the name only.

Empty: **No finished games on this board yet.**

The home weekly top 5, later, is this board for All models, this week, five rows: rank, name, score.

## Profile

Later. Not in the first build.

`/me` will show the username, a way to change it, stats, and past games. The same username rules apply. Names stay non-unique. Past games open the result page when the round is over, and the round page when it is still active. The model name is absent while the round is active.

## Admin

Later. The screens are specified in [Admin](admin.md). The first build does not link to them.
