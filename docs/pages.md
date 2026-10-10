# Pages

Play routes redirect to `/login` when there is no session, then to `/welcome` when `profiles.username` is null. The landing page and `/login` are the exceptions. Transcripts of other people are never shown.

There is no `/rules` page. The design doc stays private. The main page has a short explanation of each category. The only public scoring text is the short block on the result page.

The words below are the copy. Change them here before changing them in components.

The site is English. A second language waits until there is a translation to ship. Until then there is no locale prefix, no dictionary, and no translation columns. Error codes stay codes, so a later translation does not rewrite the API. The system prompt stays English and is not told a language, so the model's reply language can still be a clue.

## Theme

Light and dark are both first-class. The first visit follows the phone or the computer (`prefers-color-scheme`). A control in the account menu switches them and stores the choice in the browser, so it survives a refresh and applies on the landing page before anyone is signed in. It is not a column on the profile. The account button sits at the top right. Signed out, it is a person icon and the menu has **Sign in**. Signed in, the icon is a pattern generated from the account id until they upload a picture, and the menu shows the username and **Profile**. When `app_metadata.admin` is true, that same menu also shows **Admin**. The item is rendered on the server for that session. It is not a flag in client JavaScript.

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

On a light page the mark flips: black question mark, the same teal dot, paper behind it. The dot does not change between themes. At full size the period is a robot head the size of that dot: a small rounded square, square eyes, a straight mouth, no antenna. A round face reads as a person, and the LLM joke disappears. The head does not grow into a body under the question mark. 

## Look

Neat and simple. A player should see the game, not a generated marketing page.

Flat color from the palette above. No gradient fills, no glass, no blur, no glow behind the logo. One typeface. Corners stay slight. Motion stays small: a reply arriving word by word, waiting dots, a trait chip unveiling, a short shake on a wrong guess. No decorative loops, no bouncing logo, no animated background.

The landing page is the title, one sentence, the limits, a short line for each category, and Play. No feature grid, no quotes, no logo wall, no animated background. Teal marks the next action. It is not a wash across the page.

The logo has two versions, and the rule is about where the text sits.

- **Text on the right of the logo: use `tail_right`.** The tail points toward the title. This is the header and the landing lockup, where the title is to the right of the mark.
- **Text on the left of the logo: use `tail_left`.** Same idea, mirrored layout.

The source files are Gael's, in `logo/light/` and `logo/dark/`, named `whos_that_llm_logo_tail_right.png` and `whos_that_llm_logo_tail_left.png`. Never edit, flip, or redraw them. The site uses byte copies in `public/brand/`, named `logo-tail-right-light.png`, `logo-tail-right-dark.png`, `logo-tail-left-light.png`, and `logo-tail-left-dark.png`. Light theme uses the light files and dark theme uses the dark files. Where no text sits beside the mark, leave the mark out rather than picking a side. The favicon is the no-dot artwork, `whos_that_llm_favicon.png`. Light theme gets the file in `logo/light/` and dark theme the file in `logo/dark/`, chosen with `prefers-color-scheme`. `public/brand/favicon-{light,dark}-{32,96,512}.png` are the same files cropped to the circle and resampled so a tab icon stays sharp, and `app/apple-icon.png` is the light one on white. Never use the `_dot` files.

## Phones

The same site, in the browser. There is no separate app.

A narrow screen stacks the round: header, transcript, input, then feedback and hints. A wide screen puts feedback and hints on the right. Buttons and list rows are large enough to tap. The message field stays visible when the keyboard is open. The guess search is a normal text field, not a hover menu. Leaderboard and admin tables scroll sideways rather than squeezing the words off the screen.

Admin is usable on a phone and comfortable on a computer. Playing a round is the flow that has to feel good in one hand.

## Footer

On every page, including the round and admin.

- A line separates the footer from the page.
- **The models invoice the developer. Cover a round on Ko-fi.** opens `tipUrl` in `lib/config.ts` in a new tab. An empty string keeps the sentence as a placeholder: **The models invoice the developer. A Ko-fi will sit here when you feel like covering a round.**
- **Created by Gael Lederrey with Cursor**, with the Cursor logo. **Gael Lederrey** links to `https://github.com/glederrey`. **Cursor** and the logo link to `https://cursor.com`.

A tip does not raise the hourly cap, change a score, or put a name on the leaderboard.

## Landing (`/`)

Purpose: present the game. Public. Playing requires a session, and that happens on `/play`. The leaderboard does not.

The header keeps the name and a logo the same height as that text, plus **Scoring** (links to `/scoring`), **Leaderboard** and the account menu.

Two columns. On a narrow screen they stack.

- Left: the logo, large.
- Right: **Find the model.** Then: a hidden model answers you. You have ten messages. Name it when you want. Find it, and the round is yours. Miss the name, and the company and the region can still count.
- Under the buttons: three counts. **Models in play** is the enabled roster. **Games today (UTC)** counts games whose `started_at` is on the current UTC day. **Players** is the number of distinct accounts that have started a game.
- Under the counts: **Top 5 · All models**, all-time, columns rank, name, score. The name has that player's profile picture beside it. **Full leaderboard** opens `/leaderboard?category=all&period=all`.
- **How scoring works** links to `/scoring`.
- Signed out: **Sign up** goes to `/login?tab=create&next=/play`. **Sign in** goes to `/login?next=/play`.
- Signed in: **Play** goes to `/play`.
- Under the buttons: **The leaderboard is open to everyone. An account is only for playing.** The scoring link sits in that line.

A confirmation or password-reset link returns here. If the URL carries a session and the profile has no username, send the player to `/welcome`.

## Login (`/login`)

One narrow card. The heading is **Sign in** or **Create account**. A text link under it switches to the other. **Continue with Google** is first, then a divider, then email and password. **Forgot password** sits under the password field on sign-in, as a text link.

- Button: **Continue with Google**
- Fields: email, password
- Create-account note: **Supabase will email you a confirmation link.**
- Button: **What we store.** Closed until clicked. Then: we keep the username and the games (messages, replies, and guesses), for research, because the developer is a data scientist. Nothing else is kept. The email is not saved with the game. Sign-in goes through Supabase, which uses it only to confirm the account and to keep automated sign-ups out.
- Link: **Forgot password**. Asks for an email. Supabase sends the reset. The page says **Check your email.** either way, so it does not reveal whether the address exists.
- The confirmation link and the reset link both open `/`.
- Errors, under the form, one at a time:
  - **Wrong email or password.**
  - **Confirm your email, then come back.**
  - **That email is already registered.**
  - **Google sign-in was cancelled.**

## Lobby (`/play`)

Requires a session. No session goes to `/login?next=/play`. No username goes to `/welcome?next=/play`.

- Heading: **Game categories**
- Line: **One LLM, 10 messages. Guess which one it is, and earn a place on the leaderboard.** **How scoring works** links to `/scoring`.
- A status bar: **7 games left**, then **Adding a new game to the pool at 14:22** when a round has already started in the rolling hour. The time is the oldest `started_at` in that window plus one hour, in the viewer's local zone. At the cap: **None left** and **Next one at 14:22.** Right-aligned on the same row: **Twenty games an hour. One more, and the developer goes broke.** The number is `hourlyCap`, written as a word up to twenty. When the game is paused, the bar says **The game is paused.**
- Category rows. Daily first, then All models, Company, Family, Region, Custom. A category that is not enabled yet has **Not open yet.** and no button. The sentences are the `categories.blurb` column:

| Card | Sentence |
|---|---|
| Daily | The same model for everyone today. |
| All models | Any model in the roster. Name it, or take the region and the company. |
| Company | The lab is already known. Name the model. |
| Family | One family. Name the model. |
| Region | USA, China, or Europe. |
| Custom | A custom choice of models. |

- Daily block, later, and only when Daily is enabled: **Today's model is live.** Button **Play today's**. The name is absent. Disabled, with **The game is paused.**, when the game is paused. No session goes to `/login` and then into today's round. An open daily round shows **Continue**. A day already started, including a give-up, shows **You already played today's model.** and does not start another.
- Weekly top 5, later: rank, name, and score from the All models board for the current week, limited to 5. If the week has no counted round: **No finished games this week.**
- **Play** sits on the category row. All models starts the round. The other rows stay **Not open yet** until they are built.
- An open round turns that **Play** into **Continue**.
- **Play** is disabled when the hour is full, the game is paused, or the All models pool has fewer than 2 models (**Not enough models.**).
- Under the All models row, a full-width option, off by default: **Play without hints.** Beside it: **No hints. No match feedback. Score × 1.5.** It stays editable until Play.

Company, Family, and Region go to `/play/new?category=…` once they are built. Custom is a later choice of models. There is no Latest card and no Origin card.

## Username (`/welcome`)

Shown once, when `profiles.username` is null.

- **Pick a username.**
- Field, placeholder `Human`. The field starts filled with **Human**, so Save keeps that name unless they change it.
- Button: **Save**
- Shape error: **3 to 20 characters.**
- Capitals and punctuation are allowed. Shared names are allowed. Save stores the name on that profile.
- Save goes to `/play`, or back to the play URL they were trying to open.
- **Picture** is optional. A JPEG, PNG, or WebP under 1 MB. Anything else shows **Use a JPEG, PNG, or WebP under 1 MB.** Skipping it leaves the generated mark. They can add one later from the profile.

## Pool picker (`/play/new`)

Later, for Company, Family, and Region. Heading is the category name. The list is legal pools only.

Each row: pool name, model count, button **Start**. The row does not list model names. A count under 4 adds **Small set.**

Region rows are labeled **USA**, **China**, and **Europe**. Latest has no picker. Its one pool is the newest enabled model in each family, and the card starts the round. Fewer than two of those models and the card says **Not enough models.**

Empty state: **Nothing to play in this category yet.** Link back to the lobby.

The no-hint checkbox is on this page too. Company and Family have nothing to hint, so the subline is **No match feedback. Score × 1.5.** Region keeps **No hints. No match feedback. Score × 1.5.**

Start calls `POST /api/games` and routes to `/play/[gameId]`. Failures:

- **You already have a game open.** Link: **Continue**
- **Hourly limit reached. Next game at 14:22.**
- **You already played today's model.** Only the daily card can produce this.

## Round (`/play/[gameId]`)

The result is a page, not a popup. When the round ends, go to `/play/[gameId]/result`.

On a phone, feedback and hints sit under the transcript, as in [Phones](#phones). On a wide screen they sit on the right.

### Header

Always visible.

- `Message 2 of 10`. Before the first send: `Message 1 of 10` with the input empty, so the cap is there before they type.
- Pool label: `All models`, `Family · Opus`, `Company · Anthropic`, `Region · USA`, `Daily`, `Custom`
- **No hints** when the box was checked
- **Give up**. Asks **End the round? You will see the model. This round stays off the leaderboard.** Buttons **Keep playing** and **Give up**.

The score is not shown in the header. It is computed when the round ends.

### Transcript

User and assistant bubbles. The system prompt is never rendered. The user bubble is plain text. The assistant bubble is Markdown: bold, lists, and code. Raw HTML is not rendered. The assistant bubble streams word by word. Until the first word arrives, the bubble shows a waiting animation. The guess stays closed until the full reply is stored.

Input under the transcript:

- Placeholder: **Ask something**
- Counter: `120 / 500`
- Enter sends. Shift+Enter inserts a newline.
- Disabled while a reply streams, at ten messages, or when the round is over. A guess being open does not lock the composer.
- Empty and whitespace-only sends are ignored. They do not spend a message.

A stored assistant reply that is empty or whitespace still spends the message and opens the guess. The bubble can be blank.

### Guess bar

Appears when `awaitingGuess` is true. Heading: **Guess for message 2.**

Search field, placeholder **Search models**. The rows stay closed until the field is focused, then open as a dropdown: logo, company, and name. Nothing else. A chosen model replaces the placeholder in that field. Submit is enabled when a row is selected. Under the heading: **You can guess, or send another message.** On the tenth reply: **Last message. Name the model, or give up.** A wrong guess slides into **Previous guesses** and stays there. That model leaves the search list. A model already guessed is not offered again. Sending the next message leaves that turn without a guess.

Each previous guess shows the logo, the company, and the name, then the traits it missed: **Wrong company**, **Wrong region**, **Wrong family**. A trait the pool already shares is left off that line. A trait it got right is left off too, because the board unveils that row. If none of those three missed, the line is **Wrong model**. No-hint mode keeps the model and says **Wrong model**, with no trait words.

The list is the one the server already filtered. A guess the server rejects: **That model is not in the list.**

### Feedback

Hidden for the whole round when no-hint mode is on. Origin renders none of it.

The board sits on the right. Every row looks the same: the trait, then **Not found yet**, or the unveiled value. Company, region, family, year, and size are on the board as soon as the round opens. A miss does not change a row to **Wrong**. The miss is named on the previous-guess card. A hit unveils that row: **Anthropic**, **USA** with the USA, China, or Europe flag, or **Opus**. A trait the pool already shares is unveiled from the start, except year and size.

Year and size read **Not found yet** until the click, with **Reveal** when the pool shares that trait, or **Reveal (−100 pts)** when the models differ. The click reveals the year or the size. The button does not come back.

Point numbers for a match stay off this board. They are on the result page. Naming the model leaves the round before another feedback pass.

### Hints

On the same board, from the moment the round opens, when this category allows hints and no-hint mode is off.

- **Reveal**, or **Reveal (−100 pts)** when the years or the sizes differ

One click. The button disables until the response returns. A revealed year shows the calendar year, such as **2026**. A revealed size shows **Small**, **Medium**, or **Large**. The button does not come back.

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

The score is the integer from [Rules](rules.md), never below 0. When the total comes to less than 0 before the floor, a **Floor at 0** line brings it to 0.

The breakdown is the lines from [Rules](rules.md), in that order, then **Total**. The parts add up to the total.

Next to the breakdown, heading **How this score works**, these lines and no others. Fill them with this round's numbers.

> Your score starts from the base and subtracts penalties. That is multiplied by the token factor, then by 1.5 if you played with no hints. It is rounded and never goes below 0.

- Base: **2,000** for naming the model.
- Or, when the model was not named: **Base: 400** — region 100, company 300. Drop a trait that did not match, was given, or was revealed, so a region-only base reads **Base: 100** for the region, a company-only base reads **Base: 300** for the company, and nothing matched reads **Base: 0**.
- **Hints: Year −100. Size −100.** When none were bought: **Hints: none.**
- **Wrong guesses: 1 × −100.** When none were made: **Wrong guesses: none.**
- **Before the multiplier: 2,000 − 200 = 1,800.**
- **Tokens: 500.** Token factor **1,000/500.** Under 100 tokens: **Tokens: 40, counted as 100.** Token factor **1,000/100.**
- When no-hint mode was on and no hint was bought: **No-hint: ×1.5.**
- When the total came to less than 0: **The total came to less than 0, so it is shown as 0.**

**How scoring works** links to `/scoring`, including when the round has no score. The public page states the formula once, with one worked example. This result block stays this round's own lines.

That block, plus the public scoring page, is the scoring explanation on the site.

Daily stats, later, on a daily result, once at least one daily round has finished:

- **41% solved it.**
- **Messages: 3 used 1 reply · 10 used 2 · …**
- **55% got the company.**
- **Average tokens: 1,420.**

## Leaderboard (`/leaderboard`)

**Back** returns home. It is a text button with a chevron, larger than a footnote link.

Tabs are the categories with a leaderboard that are enabled. That is All models, and Daily when it is open. A main family board can be turned on later. Company, Region, and Custom are not tabs.

A second switch: **This week** and **All time**. Weeks start Monday 00:00 UTC. The tab label says **This week (UTC)**.

A counted round is `solved` or `miss`. Give-up does not appear. Rank is the best score, highest first. Ties break by fewer messages on that round, then by earlier finish. A score of 0 stays on the board.

| Column | Meaning |
|---|---|
| Rank | Position by best score |
| Name | Username copied onto that round, with the player's picture beside it |
| Score | That best score |

Two players may share a username. They are separate rows, because the account id is different. The page shows the name and the picture. The account id is not shown. A player with no uploaded picture keeps the generated mark.

Row colors, on the leaderboard page and on the landing top 5. Rank 1 is gold, rank 2 is silver, rank 3 is bronze. The signed-in player's row is teal. If the signed-in player is rank 1, 2, or 3, the row keeps its gold, silver, or bronze. It is not replaced by teal. That row is marked with a teal ring and a **You** tag instead, so both facts show. On any other rank, the signed-in row is teal with the same ring and tag.

Twenty rows per page. **Previous** and **Next** move the page. **Your place** appears when the signed-in player has a row and it is not on the current page. It opens the page that contains them.

Empty: **No finished games on this board yet.**

The landing top 5 is this board for All models, all time, five rows: rank, name, score, with the same picture beside the name.

## Profile (`/profile`)

Private. The account menu shows **Profile** once the player has a username. No session goes to `/login?next=/profile`. No username goes to `/welcome?next=/profile`. There is no id in the URL, so a player only opens their own page.

- Username field, same rules as welcome. **Save** updates the profile and every game row for that user id. The leaderboard follows. An empty name is rejected.
- **Picture.** Optional upload, JPEG, PNG, or WebP, at most 1 MB. A larger file or any other type shows **Use a JPEG, PNG, or WebP under 1 MB.** It replaces the generated mark in the header. People who skipped it on welcome add it here.
- Stats: games played, solved, missed, given up, solve rate, best score, average score, average messages on a solved game.
- Games: 10 per page, **Previous** and **Next**. Clicking a row opens its summary in place, directly under that row, and clicking it again closes it. One row is open at a time. The summary shows the company logo and model name, date, status, score, messages used, and whether company and region were found. No transcript. A logo that fails to load is hidden. An open round hides the model and logo and links to **Continue**.
- **Delete account.** Under the games. The player checks **I want to delete my account.** and submits **Delete account**. Clicking the button before that box is checked does not submit, does not reload, and does not move the page. The delete runs only after the box is checked. The same form is on `/account/delete`.

## Delete account (`/account/delete` and `/profile`)

The account menu does not link to delete. The form is on the profile page. `/account/delete` still has the same form for a direct visit. No session goes to `/login?next=/account/delete`. There is no control that names another player.

The copy says this removes the profile, the picture, and the games, including the name on the leaderboard. The server uses the session id. A user id in the form is ignored. It deletes that user's `usage` rows and `games` rows. Messages and guesses go with the games. The picture in the `avatars` bucket is removed, then the auth user is deleted, which removes the profile. The session ends on `/`. On the profile page, an unchecked box shows **Confirm that you want to delete your account.** in place, without leaving the scroll position. On `/account/delete`, an unchecked box stays on that page with the same sentence. A failed delete stays there with **Could not delete this account.** Run [`0014_delete_games_with_account.sql`](../supabase/migrations/0014_delete_games_with_account.sql) so the games foreign key cascades. The server deletes the rows itself, so the account can be removed before that file is applied.

## Private pages

`/admin` and `/admin/models` are linked from the account menu only when the signed-in Supabase user has `app_metadata.admin === true`. Players cannot write `app_metadata`. A missing flag matches nobody. The footer, the landing page, and every other session have no admin link. Anyone else, including a signed-out visitor and a player who edits their profile, gets the same not-found page as a missing URL. There is no role column and no client flag.

`/admin` shows five counts: models in the roster, active models, players, games today (UTC), and total games. Players are distinct accounts that have started a game. Those counts are read with the server key after the check. They are not a public API. Under the counts, each roster model shows its OpenRouter list price for prompt and completion, per million tokens. The page reads the public model list and does not send the API key. A model missing from that list, or a price that is not a number, shows **No price**. If the list cannot be loaded, the page says **OpenRouter prices could not be loaded.** and does not invent a number.

`/admin/models` has a closed **Add a model** dropdown, a search box (display name, family, company), and two tables: active models first, inactive second. Each lists display name, family, company, region, year, and size, 10 per page with **Previous** and **Next**, paged on its own. Paging keeps the scroll position. **Turn on** is green. **Turn off** is red, and **Edit** sits next to it. The OpenRouter id is only in the edit form. Turning a model off leaves it out of new rounds. Add one by typing an OpenRouter id, a display name, a company, a family, a region, a year, and a size. Edit those fields on a row, including the family. A new family name is saved when it is not already in the list. A new model starts off. Past games keep the traits they froze. Company logos come from the `logos` bucket. Logo upload, categories, and scoring settings are not on these pages.

The later cockpit (spend, categories, families, confusion, transcripts) is still specified in [Admin](admin.md).
