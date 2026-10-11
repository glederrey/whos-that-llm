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
- **The API bill is winning, a little help?**, with the Ko-fi cup, opens `tipUrl` in `lib/config.ts` in a new tab. An empty string keeps the sentence as a placeholder: **The models invoice the developer. A Ko-fi will sit here when you feel like covering a round.**
- **Created by Gael Lederrey with Cursor**, with the Cursor logo. **Gael Lederrey** links to `https://github.com/glederrey`. **Cursor** and the logo link to `https://cursor.com`.

A tip does not raise the hourly cap, change a score, or put a name on the leaderboard.

## Landing (`/`)

Purpose: present the game. Public. Playing requires a session, and that happens on `/play`. The leaderboard does not.

The header keeps the name and a logo the same height as that text, plus **Scoring** (links to `/scoring`), **Leaderboard**, **Statistics** (links to `/statistics`), **Why this game?** (links to `/why`), and the account menu.

Two columns. On a narrow screen they stack.

- Left: the logo, large.
- Right: **Find the model.** Then: a hidden model answers you. You have ten messages. Name it when you want. Find it, and the round is yours. Miss the name, and the company and the region can still count.
- Under the buttons: three counts. **Models in play** is the enabled roster. **Games today (UTC)** counts games whose `started_at` is on the current UTC day. **Players** is the number of distinct accounts that have started a game.
- Under the counts: **Top 5**, with the same bar as the full leaderboard. It shows that board's rows, stopped at 5. **Full leaderboard** opens `/leaderboard` with the same choice. Changing a control on either page is the same choice on the other.
- Signed out: **Sign up** goes to `/login?tab=create&next=/play`. **Sign in** goes to `/login?next=/play`.
- Signed in: **Play** goes to `/play`.
- Under the buttons: **The leaderboard is open to everyone. An account is only for playing.** Scoring is the header link.

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

- Heading: **Game modes**
- Line: **One LLM, 10 messages. Guess which one it is, and earn a place on the leaderboard.** Scoring is the header link.
- A status bar: **7 games left**, then **Adding a new game to the pool at 14:22** when a round has already started in the rolling hour. The time is the oldest `started_at` in that window plus one hour, in the viewer's local zone. At the cap: **None left** and **Next one at 14:22.** Right-aligned on the same row: **Twenty games an hour. One more, and the developer goes broke.** On a narrow screen the count, the time, and that sentence stack on the left. The number is `hourlyCap`, written as a word up to twenty. When the game is paused, the bar says **The game is paused.**
- Category rows. Daily first, then All models, Class, Company, Region, Custom. A category that is not enabled yet has **Coming soon.** and no button. The sentences are the `categories.blurb` column:

| Card | Sentence |
|---|---|
| Daily | The same model for everyone today. |
| All models | Any model in the roster. Name it, or take the region and the company. |
| Class | One class of models. Opus, or GPT vs Claude. |
| Company | The lab is already known. Name the model. |
| Region | USA, China, or Europe. |
| Custom | A custom choice of models. |

- Daily block, later, and only when Daily is enabled: **Today's model is live.** Button **Play today's**. The name is absent. Disabled, with **The game is paused.**, when the game is paused. No session goes to `/login` and then into today's round. An open daily round shows **Continue**. A day already started, including a give-up, shows **You already played today's model.** and does not start another.
- Weekly top 5, later: rank, name, and score from the All models board for the current week, limited to 5. If the week has no counted round: **No finished games this week.**
- Each mode row opens. Inside, **Choose difficulty** lists Easy, Medium, Hard, and Impossible, each in its own color, with the turned-on model count and one short line. Only All models can start a round. The other modes use the same open row and stay **Coming soon**. Custom has no difficulty: **The player chooses that pool.**
- An open All models round shows **Continue** beside the row.
- A difficulty is disabled when the hour is full, the game is paused, a round is already open, or that pool has fewer than 2 turned-on models.
- Inside the open All models row, off by default: **Play without hints.** Beside it: **No hints. No match feedback. Score × 2.** It stays editable until a difficulty is chosen.

Company and Region go to `/play/new?category=…` once they are built. Custom is a later choice of models. Hints can be on for that choice, and it has no leaderboard. Class is a card with **Coming soon.** The class game mode is not built. There is no Family card, no Latest card, and no Origin card.

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

Later, for Company and Region. Heading is the category name. The list is legal pools only.

Each row: pool name, model count, button **Start**. The row does not list model names. A count under 4 adds **Small set.**

Region rows are labeled **USA**, **China**, and **Europe**. Region has no hints. Latest is not a card. A latest group is a class, and that mode is not built. Class has no picker yet. Fewer than two models and a later card says **Not enough models.**

Empty state: **Nothing to play in this category yet.** Link back to the lobby.

Hints are possible only on Daily, All models, and Custom. Company, region, class, and latest have no hints. The no-hint checkbox is on All models. Custom, when it is built, can turn hints on and has no leaderboard.

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
- Pool label: `All models`, `Company · Anthropic`, `Region · USA`, `Daily`, `Custom`
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

Search field, placeholder **Search models**. The rows stay closed until the field is focused, then open as a dropdown: logo, company, and name. Nothing else. A chosen model replaces the placeholder in that field. Submit is enabled when a row is selected. Under the heading: **You can guess, or send another message.** On the tenth reply: **Last message. Name the model, or give up.** A wrong guess slides into **Previous guesses** and stays there. That model leaves the search list. When hints are on, a wrong company also removes every other model from that company. A right company leaves its other models in the search. No-hint mode still only removes the model that was named. A model already guessed is not offered again. Sending the next message leaves that turn without a guess.

Each previous guess shows the logo, the company, and the name, then the traits it missed: **Wrong company**, **Wrong region**. A trait the pool already shares is left off that line. A trait it got right is left off too, because the board unveils that row. If neither of those missed, the line is **Wrong model**. No-hint mode keeps the model and says **Wrong model**, with no trait words.

The list is the one the server already filtered. A guess the server rejects: **That model is not in the list.**

### Feedback

Hidden for the whole round when no-hint mode is on. Origin renders none of it.

The board sits on the right. Every row looks the same: the trait, then **Not found yet**, or the unveiled value. Company, region, year, and size are on the board as soon as the round opens. A miss does not change a row to **Wrong**. The miss is named on the previous-guess card. A hit unveils that row: **Anthropic**, or **USA** with the USA, China, or Europe flag. A trait the pool already shares is unveiled from the start, except year and size.

Year and size read **Not found yet** until the click, with **Reveal** when the pool shares that trait, or **Reveal (−100 pts)** when the models differ. The click reveals the year or the size. The button does not come back.

Point numbers for a match stay off this board. They are on the result page. Naming the model leaves the round before another feedback pass.

### Hints

On the same board, from the moment the round opens, when this category allows hints and no-hint mode is off. No-hint rounds do not show these buttons.

- **Reveal**, or **Reveal (−100 pts)** when the years or the sizes differ
- **Reveal (−600 pts)** on company, and **Reveal (−400 pts)** on region, when that trait is not already unveiled. A trait the pool shares stays unveiled with no button.

One click. The button disables until the response returns. A revealed year shows the calendar year, such as **2026**. A revealed size shows **Small**, **Medium**, or **Large**. A revealed company or region shows that value. The button does not come back.

### Failures on the round

- Model call failed, not a credit error: **The reply failed. Send it again.** The draft stays in the input. The message was not counted.
- OpenRouter 402 or an explicit credit error: **The game is paused. Try again later.** The draft stays. The message was not counted. Every player is paused, not only this one.
- Already paused: **The game is paused. Try again later.**
- Hint rejected: **That hint is not available.**
- Lost the session: redirect to `/login`, then back to this round.

## Result (`/play/[gameId]/result`)

A page, not a popup. Only for `solved`, `miss`, and `given_up`. An active round redirects to the round page. Refresh is safe.

- Logo, model name, company, region, year, and size. Origin names the model here. The round never did.
- Status line: **Solved on message 2.** or **Miss.** or **Given up. This round is not on the leaderboard.**
- The score, then the breakdown, then the short explanation. A give-up before any reply has no score and no breakdown. The status line is enough.
- The transcript
- **Play again** returns to the lobby. It does not start a round. A company or region round returns to that category's pool picker. Latest returns to the lobby.
- **Leaderboard**, shown when this category has a leaderboard and the status is `solved` or `miss`

The score is the integer from [Rules](rules.md), never below 0. When the total comes to less than 0 before the floor, a **Floor at 0** line brings it to 0.

The breakdown is the lines from [Rules](rules.md), in that order, then **Total**. Penalty lines are minus points. The token line and the no-hint line are multiplier rows: token count and the × factor, not points removed. The total is the multiplied result.

Next to the breakdown, heading **How this score works**, these lines and no others. Fill them with this round's numbers.

> Your score starts from the base and subtracts penalties. That subtotal is multiplied by 10,000 divided by the tokens used, capped at 10, then by 2× if you played with no hints. It is rounded and never goes below 0.

- Base: **2,000** for naming the model.
- Or, when the model was not named: **Base: 400** — region 100, company 300. Drop a trait that did not match, was given, or was revealed, so a region-only base reads **Base: 100** for the region, a company-only base reads **Base: 300** for the company, and nothing matched reads **Base: 0**.
- **Hints: Year −100. Size −100.** When none were bought: **Hints: none.**
- **Wrong guesses: 1 × −100.** When none were made: **Wrong guesses: none.**
- **Before the multiplier: 2,000 − 200 = 1,800.**
- **Tokens: 500.** Token factor **×10** (10,000/500, capped at 10). At 2,694 tokens: **Tokens: 2,694.** Token factor **×3.712** (10,000/2,694). At 0 tokens: **Tokens: 0.** Token factor **×10.**
- When no-hint mode was on and no hint was bought: **No-hint: ×2.**
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

One bar. Game modes sit on the left, in play-page order: Daily, All models, Class, Company. Region and Custom are not on it. All models is the open mode. Daily, Class, and Company stay visible and grayed out, and they cannot be selected while those game modes are closed. A closed mode in the URL falls back to All models.

The middle is one slot, and it follows the selected mode. All models, and Daily once that mode is open, use the difficulty tabs: **Any difficulty**, **Easy**, **Medium**, **Hard**, and **Impossible**. Those tabs stay hidden while Daily is grayed out. Class uses a dropdown of every class, and that dropdown shows only when Class is selected. Company uses a dropdown of every company, and that dropdown shows only when Company is selected. With All models selected, the bar is the mode tabs, the difficulty tabs, and This week or All time. No class or company dropdown is visible.

Any difficulty is a score from whichever difficulty was played. That board shows a difficulty chip on the row, in that difficulty's color. The other four do not. A round played with no hints has a **No hints** chip on every one of the five. The opening board is All models, Any difficulty, this week.

**This week** and **All time** stay on the right. Weeks start Monday 00:00 UTC. The tab label says **This week (UTC)**.

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

The landing top 5 uses this same bar and the same rows, stopped at 5. Columns: rank, name, score, with the same picture beside the name.

## Why this game? (`/why`)

Public. No session. Linked from the header.

First person. The words:

- **Who's that LLM?** is bold, then **started with something a friend said:**
- The line is large, in the teal, with quotation marks: **“Over time I think I could tell an Opus 4.5 from a 4.7 and a 4.8. Like a wine...”**
- **I laughed, and then I couldn't stop thinking about it. Can people actually tell models apart from just a few messages? Or do we only think we can?**
- **I'm a data scientist, so my first instinct was to collect data. That's really what this game is for. Sure, it's fun to play, but every round also tells me something: which models get confused with each other, whether big models are easy to spot next to small ones, whether a model's origin shows through, and plenty of things I haven't thought of yet.**
- **I plan to share this data openly for research later on. Until then, the statistics page shows what the data says so far.** **statistics** links to `/statistics`.
- Heading: **What I store.** **I keep your username and your game data: the messages, token counts, your guesses, which model you were talking to, and the other details of each round. That's it. I don't collect any other personal information. Sign in is handled by Supabase. Your email is stored there only so you can log in, and I never use it for anything else. I never see your password.**
- **You can delete your account at any time from your profile. Your username comes off the leaderboard. Finished games stay in the statistics without your username.** **profile** links to `/profile`.
- Heading: **Who am I.** **I'm Gael, a data scientist based in Fribourg, Switzerland, with a PhD from EPFL.** His master thesis was about beer reviews. He built the game on his own time and pays for the API calls. A tip is optional. **Ko-fi** links to `tipUrl`. **LinkedIn** links to `https://www.linkedin.com/in/gael-lederrey`. **GitHub** links to `https://github.com/glederrey`.

## Statistics (`/statistics`)

Public. No session. Linked from the header. It does not show prices, spend, or OpenRouter billing. The heading is **Statistics**, then **Games**. There is no intro under the heading.

Rates use finished games. A round still open is in the totals and stays out of any list that would name its model. A game with no account still counts. A category with no finished games says **No finished games in this category yet.** It does not show a made-up rate. Categories come from the `categories` table, so a later category appears here with that empty state until it has a finished round.

- Solve rate, give-ups, correct guesses, messages per game, tokens per game, region found
- Games started per UTC day, last 14 days
- Which models are hardest to find: games, solve rate, messages when solved, tokens
- Wrong names: hidden model, the model named instead, and how often
- Size, region, and class of the hidden model. Class uses current class membership. A round counts in each class that model belongs to. A model with no class is left out, and the page does not invent a class for it
- One block per category. Family is not a category and not a section

Tokens are prompt plus completion. Nothing on this page is a price.

## Profile (`/profile`)

Private. The account menu shows **Profile** once the player has a username. No session goes to `/login?next=/profile`. No username goes to `/welcome?next=/profile`. There is no id in the URL, so a player only opens their own page.

- Username field, same rules as welcome. **Save** updates the profile and every game row for that user id. The leaderboard follows. An empty name is rejected.
- **Picture.** Optional upload, JPEG, PNG, or WebP, at most 1 MB. A larger file or any other type shows **Use a JPEG, PNG, or WebP under 1 MB.** It replaces the generated mark in the header. People who skipped it on welcome add it here.
- Stats: games played, solved, missed, given up, solve rate, best score, average score, average messages on a solved game.
- Games: 10 per page, **Previous** and **Next**. Clicking a row opens its summary in place, directly under that row, and clicking it again closes it. One row is open at a time. The summary shows the company logo and model name, date, status, score, messages used, and whether company and region were found. No transcript. A logo that fails to load is hidden. An open round hides the model and logo and links to **Continue**.
- **Delete account.** Under the games. The player checks **I want to delete my account.** and submits **Delete account**. Clicking the button before that box is checked does not submit, does not reload, and does not move the page. The delete runs only after the box is checked. The same form is on `/account/delete`.

## Delete account (`/account/delete` and `/profile`)

The account menu does not link to delete. The form is on the profile page. `/account/delete` still has the same form for a direct visit. No session goes to `/login?next=/account/delete`. There is no control that names another player.

The copy says this removes the profile and picture, and the name on the leaderboard. It does not say the games are removed. The server uses the session id. A user id in the form is ignored. It sets `user_id` and `username` to null on that user's games, and `user_id` to null on that user's usage rows. Messages and guesses stay on the games. The picture in the `avatars` bucket is removed, then the auth user is deleted, which removes the profile. If the anonymize step fails, the auth user stays. The session ends on `/`. On the profile page, an unchecked box shows **Confirm that you want to delete your account.** in place, without leaving the scroll position. On `/account/delete`, an unchecked box stays on that page with the same sentence. A failed delete stays there with **Could not delete this account.** Run [`0017_anonymize_games_on_account_delete.sql`](../supabase/migrations/0017_anonymize_games_on_account_delete.sql) so `games.user_id` can be null and the leaderboard skips those rounds.

## Private pages

`/admin` and `/admin/models` are linked from the account menu only when the signed-in Supabase user has `app_metadata.admin === true`. Players cannot write `app_metadata`. A missing flag matches nobody. The footer, the landing page, and every other session have no admin link. Anyone else, including a signed-out visitor and a player who edits their profile, gets the same not-found page as a missing URL. There is no role column and no client flag.

`/admin` shows five counts: models in the roster, active models, players, games today (UTC), and total games. Players are distinct accounts that have started a game. Those counts are read with the server key after the check. They are not a public API. Costs, game results, and each mode are on their own pages.

`/admin/costs` reads OpenRouter when the page loads: what the key has paid, and per-model activity for the last 7 and last 30 completed UTC days. It also shows the ledger (cost per game, cost per solved game, ledger spend, failed calls) and spend by hidden model, highest cost first. The key stays on the server.

`/admin/games` shows solve rate, give-ups, correct guesses, messages, tokens, games per UTC day for the last 14 days, and which models are hardest to find. It does not show cost.

`/admin/modes` shows each game category, including one with zero games: games, open, finished, solved, solve rate, and give-ups. A class leaderboard is not a row here. The class game mode is not built.

This build's admin pages are `/admin`, `/admin/costs`, `/admin/games`, `/admin/modes`, `/admin/models`, and `/admin/classes`. `/admin/models` has a closed **Add a model** dropdown, a search box (display name, company, class), and two tables: active models first, inactive second. Each lists display name, company, region, year, size, input price, output price, and classes, 10 per page with **Previous** and **Next**, paged on its own. Clicking a data header sorts both tables by that column, and clicking it again reverses the order. The turn-on and edit controls are not a sort column. Paging keeps the scroll position. **On** is green. **Off** is red, and **Edit** sits next to it. **Reset** sits by the search box only while a search is active, and saving an edit stays on that search. Turning a model off leaves it out of new rounds. Add starts with an OpenRouter id. Looking it up fills the display name, the company when that org is one we already have, the release date, and the input and output prices. Size and classes stay empty until he fills them. He can change any filled value before saving. Edit those fields on a row, including the classes and the prices. A new model starts off. Past games keep the traits they froze. `/admin/classes` creates and edits a class: name, description, optional company, no logo. Company logos come from the `logos` bucket. Logo upload, categories, and scoring settings are not on these pages. The class game mode is not here.

The later cockpit (the pause switch, categories, confusion, transcripts) is still specified in [Admin](admin.md).
