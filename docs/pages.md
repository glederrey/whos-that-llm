# Pages

Play routes redirect to `/login` when there is no session, then to `/welcome` when `profiles.username` is null. The landing page and `/login` are the exceptions. Transcripts of other people are never shown.

There is no `/rules` page. The design doc stays private. The main page has a short explanation of each category. The public scoring text is the breakdown on the result page and [How scoring works](/scoring).

The words below are the copy. Change them here before changing them in components.

The site is English. There is no second language, so there is no locale prefix, no dictionary, and no translation columns. Error codes stay codes, so a translation would not rewrite the API. The system prompt stays English and is not told a language, so the model's reply language can still be a clue.

## Theme

Light and dark are both first-class. The first visit follows the phone or the computer (`prefers-color-scheme`). A control in the account menu switches them and stores the choice in the browser, so it survives a refresh and applies on the landing page before anyone is signed in. It is not a column on the profile. The account button sits at the top right. Signed out, it is a person icon and the menu has **Sign in**. Signed in, the icon is a pattern generated from the account id until they upload a picture, and the menu shows the username and **Profile**. When `app_metadata.admin` is true, that same menu also shows **Admin**. The item is rendered on the server for that session. It is not a flag in client JavaScript.

Same layout in both themes. Text, feedback, and the guess list stay readable. A match and a miss stay distinguishable without relying on color alone.

The brand is three flat colors, taken from the logo. No fourth brand hue, and no gradient on the mark. The teal in the file is `#00BBC9`. Ink and paper sit the same distance off pure black and pure white.

| Token | Hex | Use |
|---|---|---|
| Ink | `#141414` | The logo ground. Text on light surfaces |
| Paper | `#EBEBEB` | The question mark. Text on dark surfaces. Cards in the light theme |
| Teal | `#00BBC9` | The dot. The one accent: links, the score on the result, a matched trait, the primary button |
| Teal press | `#007F88` / `#008F99` | Light theme, then dark theme. Same hue, darker than the teal. Links and the quote on a light page, and hover in both themes |
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

On every page, including the round and admin. The shared result page is the exception: it shows only the card.

- **The API bill is winning, a little help?**, with the Ko-fi cup, opens `tipUrl` in `lib/config.ts` in a new tab. An empty string keeps the sentence as a placeholder: **The models invoice the developer. A Ko-fi will sit here when you feel like covering a round.**
- **Created by one human and two AIs**, then three icon-only links, each with an `aria-label` and a hover title: a silhouette of Gael Lederrey (links to `https://github.com/glederrey`), the Cursor logo (`https://cursor.com`) and the Claude Code mascot (links to `https://claude.com/product/claude-code`), all drawn inline. All three icons use the link color. One line on desktop, after the Ko-fi line; on a phone it comes first, above the Ko-fi line, and wraps centered.

A tip does not raise the hourly cap, change a score, or put a name on the leaderboard.

## Landing (`/`)

Purpose: present the game. Public. Playing requires a session, and that happens on `/play`. The leaderboard does not.

The header keeps the name and a logo the same height as that text, plus **Scoring** (links to `/scoring`), **Leaderboard**, **Statistics** (links to `/statistics`), **Why this game?** (links to `/why`), and the account menu.

Two columns. On a narrow screen they stack.

- Left: the logo, large.
- Right: **Guess the hidden AI model** on a wide screen, and **Guess the AI model** on a phone. Then: Think you can tell AI models apart, like a wine? In this guessing game, a hidden LLM answers you. It could be ChatGPT, Claude, Gemini, or any of the N models in play. Ten messages, one guess. Take on the daily round or pick a game mode to climb the leaderboard. N is **Models in play**, the enabled roster, not a fixed number. That paragraph uses the full width of the text column.
- The search description is separate from that paragraph: **A guessing game for AI fans. Chat with a hidden LLM for ten messages and guess which model it is. Daily rounds, several game modes, and a public leaderboard.** Pages that set their own description, such as a public result, keep that one.
- Under the buttons: four counts, each centered in its card, label above the number. **Models in play** is the enabled roster. **Games today** counts finished games by the UTC day they finished. A game that started yesterday and finished today counts today. A game that starts today and finishes tomorrow does not count today. A game with `finished_at` null never counts. **Players** is the number of distinct accounts with at least one finished game. A game left behind after an account is deleted has no `user_id` and does not count. **Companies** is the number of labs with at least one model in play. A wide screen shows the four in one row. A phone shows two per row.
- Under the counts: **Top 5**, with the same bar as the full leaderboard. It shows that board's rows, stopped at 5. **Full leaderboard** opens `/leaderboard` with the same choice. Changing a control on either page is the same choice on the other.
- Signed out: **Sign up** goes to `/login?tab=create&next=/play`. **Sign in** goes to `/login?next=/play`.
- Signed in: **Start playing** goes to `/play`. Scoring is the header link.
- On a wide screen, **Start playing**, **Sign up**, and **Sign in** are taller, with rounder corners. On a phone they keep the original size.

A confirmation link returns here. If the URL carries a session and the profile has no username, send the player to `/welcome`.

## Login (`/login`)

One narrow card. The heading is **Sign in** or **Create account**. A text link under it switches to the other. **Continue with Google** is first, then a divider, then email and password. **Forgot password** sits under the **Sign in** button on sign-in, as a centered text link.

- Button: **Continue with Google**
- Fields: email, password
- Create-account note, before the account is created: **Supabase will email you a confirmation link.** After the account is created, that note is gone and the page says **The confirmation email has been sent.**
- Button: **What we store.** Closed until clicked. Then: we keep the username and the games (messages, replies, and guesses), for research, because the developer is a data scientist. Nothing else is kept. The email is not saved with the game. Sign-in goes through Supabase, which uses it only to confirm the account and to keep automated sign-ups out.
- Link: **Forgot password**. It replaces the card with a **Reset your password** card: one email field (filled with what was typed), a **Send request to change password** button, and a **Back to sign in** link. Supabase sends the reset. The card says **Check your email.** either way, so it does not reveal whether the address exists.
- The confirmation link opens `/`. The reset link opens `/reset-password?token_hash=…`.
- Errors, under the form, one at a time:
  - **Wrong email or password.** Sign-in, when the email or password does not match.
  - **Confirm your email, then come back.**
  - **An account with this email already exists.** Create account, when that email is already registered. A second try while the confirmation is still going out is the same case.
  - **The confirmation email could not be sent. Try again in a minute.**
  - **Google sign-in was cancelled.**

## Reset password `/reset-password`

The reset link does not sign anyone in. Opening it only shows this page; the link's token is spent when **Save password** is pressed, in the same server call that sets the password. Without `token_hash` the page redirects to `/login`. One narrow card, **Choose a new password**, with the same password field as sign-up (show/hide eye and the **Must contain** checklist) and **Save password**. The new password must meet the same rules as sign-up, checked before and by Supabase. Typing the current password counts as saved. A spent or expired link says so and points back to sign-in. Saving ends the session that call created and goes to `/login?notice=password-changed`, which shows **Password updated. Sign in with it.** With no session (expired or reused link) the page sends the player to `/login`.

## Lobby (`/play`)

Requires a session. No session goes to `/login?next=/play`. No username goes to `/welcome?next=/play`.

- Heading: **Game modes**
- Line: **One LLM, 10 messages. Guess which one it is, and earn a place on the leaderboard.** Scoring is the header link.
- A status bar: **7 games left**, then **Adding a new game to the pool at 14:22** when a round has already started in the rolling hour. The time is the oldest `started_at` in that window plus one hour, in the viewer's local zone. At the cap: **None left** and **Next one at 14:22.** Right-aligned on the same row: **Twenty games an hour. One more, and the developer goes broke.** On a narrow screen the count, the time, and that sentence stack on the left. The number is `hourlyCap`, written as a word up to twenty. When the game is paused, the bar says **The game is paused.**
- Category rows. Daily first, then All models, Company, Category, Origin, Custom. A mode that is not enabled has **Coming soon.** and no button. The sentences are the `game_modes.blurb` column (Daily's is replaced by the line below):

| Card | Sentence |
|---|---|
| Daily | One round per difficulty. Everyone at that level gets the same model. A new puzzle tomorrow. |
| All models | Any model in the roster. Name it, or take the origin and the company. |
| Category | A set we define, not a lab's line. Only Opus, only the nano models, or obscure ones. |
| Company | The lab is already known. Name the model. |
| Origin | Ten messages, one guess: where does this model come from? |
| Custom | Pick your own models, at least two, and guess which one is hiding. |

- Daily opens the same way as All models: **Choose difficulty**, then Easy, Medium, Hard, and Impossible, and **Play without hints.** Its sentence is **One round per difficulty. Everyone at that level gets the same model. A new puzzle tomorrow.** That sentence is the card, even when the stored blurb is still the old line. Daily is open on this page. It does not show **Coming soon.** A finished difficulty is grayed out, says **Already played.**, and cannot be started again until tomorrow. An unfinished round of that difficulty stays open and resumes. A difficulty they have not started is not grayed out. Easy and Medium on the same day are two rounds.
- Weekly top 5: rank, name, and score from the All models board for the current week, limited to 5. If the week has no counted round: **No finished games this week.**
- Daily, All models, Company, Category, Origin, and Custom open. A mode that is not enabled stays closed, with the **Coming soon** badge and no expand chevron. Origin has no difficulty, no category, and no hint choice, so its row is a plain button: a click starts the round, or resumes the open one. Inside an open mode, **Choose difficulty** lists Easy, Medium, Hard, and Impossible on one line each: the name, then the short line beside it, and the turned-on model count on the right. The colors match the leaderboard: Easy `#1c7c43`, Medium `#d4a017`, Hard `#c41b15`, Impossible `#a78bfa`, on the name and the left edge. Daily and All models can start a round. Custom has no difficulty: the player builds the pool (see below).
- An unfinished Daily or All models difficulty replaces the model count with **Game isn't finished yet. Continue?** The line is teal: `#007278` on a light page and `#00bbc9` on a dark page. Clicking that row resumes the round. The mode header has no Continue button. Origin and Custom have no rows, so while a round of that mode is open their header shows the same teal line on the right, before the arrow. Clicking either resumes the round at once. Custom then has no picker to open and its arrow points right, like Origin's. A difficulty with no open round still shows the model count and can start. A second round cannot start on a difficulty that already has an unfinished one.
- On All models, a difficulty is disabled when the hour is full, the game is paused, or that pool has fewer than 2 turned-on models. An unfinished difficulty stays enabled and resumes, including while paused or at the hourly cap. On Daily, a finished difficulty is grayed out. A difficulty they have not started stays available. The open round of a difficulty can still be resumed.
- Inside an open Category row, **Choose category** lists every category the way Company lists companies, with no search box. Each row has the icon, the name and the description, and the turned-on model count on the right, or **Game isn't finished yet. Continue?** when that category has an open round. A category with fewer than 2 turned-on models, or turned off, is not listed. A row is disabled when the hour is full, the game is paused, or it has fewer than 2 models, but an unfinished one stays enabled and resumes. **Play without hints.** sits under the list as in Company. Clicking a row starts the round.
- Inside an open Daily or All models row, off by default: **Play without hints.** Beside it: **No hints. No match feedback.** On a normal-width page that is one line. On a phone, the checkbox and **Play without hints.** stay on the first line, and **No hints. No match feedback.** moves to the next line. It stays editable until a difficulty is chosen.

- Inside an open Custom row, **Choose models** shows a search box and the models grouped by company, one model per row on a phone and on a computer (two columns on a wide screen). Each company header stays in view while its models scroll, and shows the logo, the name, the company's origin with its flag, the picked count, and **Add all** or **Drop all**. A model row has a check circle, the name, and the year and size on the right, such as **2026 · Large**. One tap toggles it. Under the list a button says **N models picked** and opens a window with the picks split by company (logo and name as the divider, each model with its year and size and a red button with a white cross to remove it), and the window has **Clear all** and **Done**. There are no chips under the list. **Play without hints.** sits as in the other modes. **Start** is enabled at 2 or more picked models. The last selection is remembered in this browser (`localStorage` key `custom-models`). A Custom round that is still open replaces the form with **Game isn't finished yet. Continue?**, because only one Custom round can be open per account. The start sends `{ gameMode: "custom", modelIds, noHint }`. Hints can be on, and Custom has no leaderboard.

Category, Origin, and Custom are open on `/play` itself, with no picker page. There is no Family card and no Latest card.

Hints are possible on Daily, All models, Company (year and size), Category, and Custom. Origin has none. The no-hint checkbox is on every open mode except Origin. Custom has no leaderboard.

Start calls `POST /api/games` and routes to `/play/[gameId]`. Failures:

- **You already have a game open.** Link: **Continue**
- **Hourly limit reached. Next game at 14:22.**
- **You already played that difficulty today.** Only the daily card can produce this.

## Username (`/welcome`)

Shown once, when `profiles.username` is null.

- **Pick a username.**
- The username box starts empty. **Human** is the gray hint inside it. The first character they type replaces that hint.
- Button: **Save**
- An empty name, or any name outside 3 to 20 characters, shows **3 to 20 characters.** and is not stored.
- Capitals and punctuation are allowed. Shared names are allowed. Save stores the name on that profile.
- Save goes to `/play`, or back to the play URL they were trying to open.
- **Picture** is optional. A JPEG, PNG, or WebP under 1 MB. Anything else shows **Use a JPEG, PNG, or WebP under 1 MB.** Skipping it leaves the generated mark. They can add one later from the profile.

## Round (`/play/[gameId]`)

The result is a page, not a popup. When the round ends, go to `/play/[gameId]/result`.

On a phone, feedback and hints sit under the transcript, as in [Phones](#phones). On a wide screen they sit on the right.

### Header

Always visible.

- `Message 2 of 10`. Before the first send: `Message 1 of 10` with the input empty, so the cap is there before they type.
- Pool label: `All models · Easy`, `Daily · Easy`, `Company · Anthropic`, `Origin`, `Custom`
- **No hints** when the box was checked
- **Give up**. Asks **End the round? You will see the model. This round stays off the leaderboard.** Buttons **Keep playing** and **Give up**.

The score is not shown in the header. It is computed when the round ends.

### Transcript

User and assistant bubbles. The system prompt is never rendered. The user bubble is plain text. The assistant bubble is Markdown: bold, lists, and code. Raw HTML is not rendered. Images are not rendered: a reply shows text only, and links open only for http, https, and mailto. The assistant bubble streams word by word. Until the first word arrives, the bubble shows a waiting animation. The guess stays closed until the full reply is stored.

Input under the transcript:

- Placeholder: **Ask something**
- Counter: `120 / 500`
- Enter sends. Shift+Enter inserts a newline.
- Disabled while a reply streams, at ten messages, or when the round is over. A guess being open does not lock the composer.
- Empty and whitespace-only sends are ignored. They do not spend a message.

A stored assistant reply that is empty or whitespace still spends the message and opens the guess. The bubble can be blank.

### Origin round

An Origin round has no guess bar and no board. Under the transcript, once a reply is stored, a row of buttons shows every origin in the round's pool, each with the Twemoji flag and the name, in the order the admin set. Choosing one marks it. **Submit guess** is enabled when one is marked, and sends it. The guess is final. The heading is **Where does it come from?** and the text under it says **One guess, then the round ends. Send more messages first if you need them.** The header says **Origin** and has no **No hints** tag.

### Guess bar

Appears when `awaitingGuess` is true. Heading: **Guess for message 2.**

Search field, placeholder **Search models**. The rows stay closed until the field is focused, then open as a dropdown: logo, company, and name. Nothing else. A chosen model replaces the placeholder in that field. Submit is enabled when a row is selected. Under the heading: **You can guess, or send another message.** On the tenth reply: **It's your last guess!** A wrong guess slides into **Previous guesses** and stays there. That model leaves the search list. When hints are on, a wrong company also removes every other model from that company. A right company leaves its other models in the search. No-hint mode still only removes the model that was named. A model already guessed is not offered again. Sending the next message leaves that turn without a guess. On a wide screen the **Previous guesses** card shrinks to fit between the top of the side column and the bottom of the writing box, so it scrolls with the page. When a short thread leaves it under 120px, it uses the bottom of the window instead, so it never collapses to its title. On a phone it shows in full.

Each previous guess shows the logo, the company, and the name, then the traits it missed: **Wrong company**, **Wrong origin**. A trait the pool already shares is left off that line. A trait it got right is left off too, because the board unveils that row. If neither of those missed, the line is **Wrong model**. No-hint mode keeps the model and says **Wrong model**, with no trait words.

The list is the one the server already filtered. A guess the server rejects: **That model is not in the list.**

### Feedback

Hidden for the whole round when no-hint mode is on. Origin renders none of it.

The board sits on the right. Every row looks the same: the trait, then **Not found yet**, or the unveiled value. Company, origin, year, and size are on the board as soon as the round opens. A miss does not change a row to **Wrong**. The miss is named on the previous-guess card. A hit unveils that row: **Anthropic**, or **USA** with the USA, China, or Europe flag. A trait the pool already shares is unveiled from the start, except year and size.

Year and size read **Not found yet** until the click, with **Reveal (−100 pts)**. When every model in the pool shares the year or the size, it is shown at once with no button and no cost. The click reveals the year or the size. The button does not come back.

Point numbers for a match stay off this board. They are on the result page. Naming the model leaves the round before another feedback pass.

### Hints

On the same board, from the moment the round opens, when this category allows hints and no-hint mode is off. No-hint rounds do not show these buttons.

- **Reveal (−100 pts)** on year and on size, when the years or the sizes differ. A year or size the pool shares is shown at once, with no button.
- **Reveal (−600 pts)** on company, and **Reveal (−400 pts)** on origin, when that trait is not already unveiled. A trait the pool shares stays unveiled with no button.

One click. The button disables until the response returns. A revealed year shows the calendar year, such as **2026**. A revealed size shows **Small**, **Medium**, or **Large**. A revealed company or origin shows that value. The button does not come back.

### Failures on the round

- Model call failed, not a credit error: **The reply failed. Send it again.** The draft stays in the input. The message was not counted.
- OpenRouter answers HTTP 402: **The game is paused. Try again later.** The draft stays. The message was not counted. Every player is paused, not only this one.
- Already paused: **The game is paused. Try again later.**
- Hint rejected: **That hint is not available.**
- Lost the session: redirect to `/login`, then back to this round.

## Result (`/play/[gameId]/result`)

A page, not a popup. Only for `solved`, `miss`, and `given_up`. An active round redirects to the round page. Refresh is safe.

- Logo, model name, company, origin, year, and size. Origin names the model here. The round never did.
- An Origin round has a different card. The model sits on top. Where the score would be, the card says **Your guess** and the origin the player chose, with its flag, or a dash for a give-up. When the guess was wrong, or the round was given up, a second line says **Comes from** and the real origin. **Game mode** says **Origin**. There is no **Difficulty** row and no breakdown. **Pool** still shows how many models the round drew from. **How scoring works** is not on the card. **Play again** returns to the lobby.
- One score card. **Your score** and the number sit on the left. On the right: the status line (**Solved on message 2** or **Failed** or **Given up**), then **Game mode**, **Difficulty** and **Pool**. A company or category round puts **Company** or **Category** and that name where **Difficulty** would be (a category that no longer exists shows **—**), here, on the result page and the profile. A long name wraps in the narrow right column. **Pool** is the size of the round's pool, written like **11 models** (a category or company round counts that group), read from the pool saved on the round, so old rounds stay right. A round with no saved pool hides that row. A round with no score (a give-up before any reply) keeps the label and shows a dash in place of the number, here, on the shared page and on the downloadable card. The labels sit right-aligned in one column and the values left-aligned in the next. A round stored with no difficulty says **—**. A Custom round shows **Custom** as the game mode, has no **Difficulty** row, and its **Pool** says how many models were picked, like **5 models**. A round played without hints puts a **No hints** chip next to the status: left of it on a wide screen, below it on a phone and on the downloadable card, on the page, the shared page and the downloadable card; there is no **Hints** row. On a phone that right-hand group stays on the right, a little smaller, so the score can sit beside it.
- **How scoring works** sits at the bottom right of that card on a wide screen, on the same line as the share buttons, and opens `/scoring` in a new tab. The page does not repeat the formula beside the breakdown. On a phone that link is not on the card.
- **Share**, **Copy link**, and **Download card** sit on one line. On a wide screen **Share** is the filled button, with a down mark, and the other two sit beside it. **Copy link** copies the public result link. On a wide screen the button flashes teal twice, quickly. It does not add a line. If the copy fails: **The link could not be copied.** On a phone the same three buttons sit side by side and together fill the width. Each label stays on one line. The button says **Download card** when that fits, and **Download** when it does not. **Copy link** does not flash and does not add a line, because the phone already shows that the clipboard changed. On a phone, **Download card** shows **Saving…** when that word fits in the button. When it does not, the button flashes teal twice. It does not add a line. The result page does not show the picture itself. The picture is the download and the link preview. The public page is the score table.
- On a phone, **Share** opens the same menu. **By message** is first, with a chat mark. It opens the system share sheet with that PNG when the browser allows it. The sheet is for a chat. When the picture is attached, that chat says **Play here: https://www.whos-that-llm.com** instead of the round link. **Copy link** is not in that menu. **X**, **LinkedIn**, and **Facebook** follow. Those posts use the round link, on a phone and on a computer. **X** opens with the message filled in and the public round page as the shared URL, so X can preview that page's card. A blank line sits before that link. It does not use **Play here**, and the PNG is not attached to the post. LinkedIn and Facebook copy that same message, including the link, and their tooltip says **This opens the post. Paste the message.** They open that same round page, so their preview can show the card too. If **By message** fails, a red line under the buttons says **Try again.**
- On a computer, **Share** opens one menu: **X**, **LinkedIn**, and **Facebook**, each with its logo. **X** opens with the message filled in and the round page as the shared URL, so X can preview the card. A blank line sits before that link. The PNG is not uploaded. LinkedIn and Facebook copy that same message, including the link. Their tooltip says **This opens the post. Paste the message.** The click does not add a line. If the copy fails: **The message could not be copied.** LinkedIn and Facebook open that page. A solved All models round reads:

  ```
  I just played on Who's that LLM? and scored 9,500 points.

  Game mode: All models
  Difficulty: Easy.

  The model I had to guess was Qwen3.8 Max.

  Do you think you can beat my score?

  https://www.whos-that-llm.com/r/…
  ```

  Daily leaves out the model paragraph. A company or category round replaces the difficulty line with that name, such as **Company: Anthropic.** A round with no score leaves out the points and the challenge. If **By message** fails: **Try again.** If the copy fails: **The message could not be copied.**
- The transcript
- **Play again** and **Leaderboard** sit at the top right, level with the model name. **Play again** returns to the lobby. It does not start a round. **Leaderboard** is shown when this category has a leaderboard and the status is `solved` or `miss`. A Custom round has no leaderboard, so only **Play again** shows, and it goes to `/play`. On a phone those two buttons sit side by side just under the score card, and together they fill the width.

The score is the integer from [Rules](rules.md), never below 0. When the total comes to less than 0 before the floor, a **Floor at 0** line brings it to 0.

The breakdown is the lines from [Rules](rules.md), in that order. Each line has the change and an **After** column, the score once that line is applied. Point lines add. The row **Before the multiplier** is the subtotal those points reach. Each later row multiplies that subtotal, and **After** shows the result. **Total** repeats the stored score. Penalty lines are minus points. The token line and the no-hint line are multiplier rows: token count and the × factor, not points removed. A finished game keeps the factor it was scored with. The scoring page states the current cap, ×20. A give-up before any reply has no score and no breakdown.

**How scoring works** opens `/scoring` in a new tab, including when the round has no score. The public page states the formula once, with one worked example.

## Shared result (`/r/[gameId]`)

Public. No session. This is the link Share on X and Share on Facebook use. It has the site header and footer. It does not show the chat, the transcript, or the share buttons. Those stay on the player's own result.

Only a finished game (`solved`, `miss`, or `given_up`). An open round or an unknown id is the not-found page.

Above the card, the player's name is the title: **Gael's game.** Under it, quieter: **Played on October 16, 2026.** The day is the UTC day the round finished. A round with no stored name has no title, only the date when one is stored. The player's own result and the profile still name the model on a Daily. This page does not, while that puzzle's UTC day is still today. In the model's place: the game logo, **Model hidden**, and **It will be revealed tomorrow.** The downloaded card uses that same placement. The next UTC day, this page and the card name the model. Other modes name it as soon as the round is finished.

When this round may name the model, the logo, the name, and the company, origin, year, and size sit above the card.

An Origin round is shared in full. The page and the downloaded card show the model, the player's guess with its flag, and, when the guess missed or the round was given up, **Comes from** and the real origin. They show no score, no breakdown, and no pool. The share text reads **I just played Who's that LLM? Origin and guessed Europe for Qwen3.8 Max. It comes from China.** (right guess: **…and got it right: Claude Sonnet 5.5 comes from the USA.**) The link under the card says **Try a round**.

**{Name}'s score** (the username stored on the round, uppercase, cut to 20 characters with an ellipsis; **Score** when the name is gone) and the number sit on the left. On the right: **Solved on message 2** or **Failed** or **Given up**, then **Game mode**, **Difficulty** and **Pool** (the pool size, like **11 models**, hidden when the round has no saved pool). A company or category round names that instead of the difficulty (category: the name of the category, also for one turned off since; a category that is gone shows its id). A name over 26 characters is cut with an ellipsis on the downloadable card. The difficulty word uses the leaderboard colors: Easy `#1c7c43`, Medium `#d4a017`, Hard `#c41b15`, Impossible `#a78bfa`. A round played without hints puts a **No hints** chip next to the status: left of it on a wide screen, below it on a phone and on the downloadable card.

The breakdown is the full score: each line, the change, and **After**, including **Before the multiplier**, then **Total**. A give-up before any reply has no score and no breakdown. This page does not link to **How scoring works**. The player's own result still does.

Under the card, a scored round says **Try to beat this score**. A round with no score says **Try a round**. That link goes to the home page.

Download still saves the picture from `/r/[gameId]/card.png`. The file is `whos-that-llm-` plus the game id, then `.png`. The picture is not the page. It has a teal frame and rounded corners. The question-mark logo and **Who's that LLM?** sit at the top, at the same height. The score sits on the left, with the same **{Name}'s score** label. On the right: the status, then **Game mode**, **Difficulty** and **Pool** in the same two columns as the page: labels right-aligned, values left-aligned, with the same colors. Under the breakdown: **Can you beat my score of 9,500?** when there is a score, or **Come try a round** when there is not, then the bare host **whos-that-llm.com** in teal (no `https://`, no `www`). Every link in a share message uses `https://www.whos-that-llm.com`. The picture does not show the chat. Download uses the theme already chosen in the browser: dark mode gets the dark logo and a dark card, light mode gets the light logo and a light card.

The link preview is that same picture. It is drawn when a share preview requests it, and it is not stored. A preview that asks for the picture without a theme gets the light card. X and Facebook are given this page, and they read the preview from `/r/[gameId]/card.png`. They are not given the PNG file, and they are not given the homepage.

## Leaderboard (`/leaderboard`)

**Back** returns home. It is a text button with a chevron, larger than a footnote link.

One bar. Game modes sit on the left, in play-page order: Daily, All models, Company, Category. Origin and Custom are not on it, because they have no leaderboard. Daily, All models, Company, and Category are open. A mode that is closed stays visible, grayed out, and cannot be selected. A closed mode in the URL falls back to All models.

The middle is one slot, and it follows the selected mode. Daily and All models use the difficulty tabs: **Any difficulty**, **Easy**, **Medium**, **Hard**, and **Impossible**. Category uses a dropdown of every category that is turned on (All categories first, each with its icon), and that dropdown shows only when Category is selected. Company uses a dropdown of every company, and that dropdown shows only when Company is selected. With Daily or All models selected, the bar is the mode tabs, the difficulty tabs, and This week or All time. No category or company dropdown is visible.

Any difficulty is a score from whichever difficulty was played. That board shows a difficulty chip on the row, in that difficulty's color. The other four do not. A round played with no hints has a **No hints** chip on every one of the five. The opening board is All models, Any difficulty, this week.

**This week**, **This month** and **All time** stay on the right when the three groups fit on one row. On a narrow screen they stack, full width, in this order: game modes, the middle control, then the period tabs. Each group's buttons share that row, so the leftover space is split evenly and the row is full. Weeks start Monday 00:00 UTC.

A counted round is `solved` or `miss`. Give-up does not appear. Rank is the best score, highest first. Ties break by fewer messages on that round, then by earlier finish. A score of 0 stays on the board.

| Column | Meaning |
|---|---|
| Rank | Position by best score |
| Name | Username copied onto that round, with the player's picture beside it |
| Score | That best score |

Two players may share a username. They are separate rows, because the account id is different. The page shows the name and the picture. The account id is not shown. A player with no uploaded picture keeps the generated mark.

Row colors, on the leaderboard page and on the landing top 5. Rank 1 is gold, rank 2 is silver, rank 3 is bronze. The signed-in player's row is teal. If the signed-in player is rank 1, 2, or 3, the row keeps its gold, silver, or bronze. It is not replaced by teal. That row is marked with a teal ring and a **You** tag instead, so both facts show. On any other rank, the signed-in row is teal with the same ring and tag.

Twenty rows per page. **Previous** and **Next** move the page. On a phone those two buttons and the page count span the width of the board, with Previous on the left and Next on the right. **Your place** appears when the signed-in player has a row and it is not on the current page. It opens the page that contains them.

The table is flush on a phone, the same as on a computer. The rows go to the edges of the card. There is no extra padding around them.

Empty: **No finished games on this board yet.**

The landing top 5 uses this same bar and the same rows, stopped at 5. Columns: rank, name, score, with the same picture beside the name.

## Why this game? (`/why`)

Public. No session. Linked from the header.

First person. The words:

- **Who's that LLM?** is bold, then **started with something a friend said:**
- The line is large, in the teal, with quotation marks: **“Over time I think I could tell an Opus 4.5 from a 4.7 and a 4.8. Like a wine...”**
- **I laughed, and then I couldn't stop thinking about it. Can people actually tell models apart from just a few messages? Especially models from the same family? Or do we only think we can?**
- **I'm a data scientist, so my first instinct was to collect data. That's really what this game is for. Sure, it's fun to play, but every round also tells me something: which models get confused with each other, whether big models are easy to spot next to small ones, whether a model's origin shows through, and plenty of things I haven't thought of yet.**
- **I plan to share this data openly for research later on. Until then, the statistics page shows what the data says so far.** **statistics** links to `/statistics`.
- Heading: **What data do I store?** **I keep your username and your game data: the messages, token counts, your guesses, which model you were talking to, and the other details of each round. That's it. I don't collect any other personal information. Sign in is handled by Supabase. Your email is stored there only so you can log in, and I never use it for anything else. I never see your password.**
- **You can delete your account at any time from your profile. Your username comes off the leaderboard. Finished games stay in the statistics without your username.** **profile** links to `/profile`.
- Heading: **Who am I?** **I'm Gael, a data scientist based in Fribourg, Switzerland, with a PhD from EPFL.** His master thesis was about beer reviews. **By the way, if you want to chat about the game, the data, or anything else, you can find me on LinkedIn and GitHub.** **LinkedIn** links to `https://www.linkedin.com/in/gael-lederrey`. **GitHub** links to `https://github.com/glederrey`.
- Heading: **Do you want to contribute?** **Who's that LLM?** is bold, then **is a small side project, and it gets better with help. If you have an idea, want to contribute, or found a bug, you're very welcome to open an issue on GitHub. Whether it's a typo or a big suggestion, I'd love to hear about it.** **open an issue on GitHub** links to `https://github.com/glederrey/whos-that-llm/issues`.
- Heading: **Do you want to support the project?** He built the game on his own time and pays for the API calls. A tip is optional. **Ko-fi** links to `tipUrl`.

## Statistics (`/statistics`)

Public. No session. Linked from the header. It does not show prices, spend, or OpenRouter billing. The heading is **Statistics**. Mode buttons are next, then the stats. There is no intro under the heading.

A game counts only when `finished_at` is set. A round that was started and not finished is left out of every figure, the chart, and the lists. The page does not say how many rounds are still open. A game with no account still counts once it is finished. Arrival shows the overall stats. Mode buttons sit under the heading: **All modes**, **Daily**, **All models**, **Category**, **Company**, **Origin**, and **Custom**. Every button can be chosen. **All modes** is the arrival view: every game mode together. Origin rounds count in its figures and its chart, but not in the guess figures or the tables that name a model. Custom has its own tab with the same report as the other modes. Choosing **Daily** or **All models** replaces the overall stats with that mode. The seven buttons share the bar in equal widths. On a phone they sit on two rows, four then three, and each row fills the width. They do not reload the page. Class is not on the overall stats. Family is not a section.

- Six figure cards on every tab, in two rows: solve rate, failed, give-ups, then correct guesses, median messages, median tokens (the median, not the mean, since a few long games skew the mean). The first row shows rates with the count under each. There is no title above them. They are centered in the card. On a phone they sit two per row. Origin guesses are origins, so on the Origin tab a guess is right when the origin is. Scores are in the tables' Average score column
- **Games over time**, the same chart on every tab: games started per UTC day, last 14 days, each bar stacked solved (green), failed (red) and given up (gray), with a legend on the left and the note on the right of the same line. Dates read day.month, like 11.10. Today's Daily rounds are in the chart and the figures, and stay out of every table that names a model
- Which models are hardest to find: games, solve rate, messages when solved, tokens. A round given up before any message is left out
- Wrong names: hidden model, the model named instead, and how often
- Size (a size with no game is left out) and origin of the hidden model, then **By difficulty** (Daily and All models only) and **Hints vs no hints**. No hints can be chosen in every mode but Origin, so the All modes split counts every mode but Origin. Each row shows games, solve rate and average score
- The Origin view: solve rate, messages and tokens per game, a table by real origin (games, found, and a Picked column with one count per origin), and the hardest and easiest models. Origin rounds count in the All modes figures and chart only.
- The Custom view: the same blocks, except that the last figure is **Models per round** (the average size of the pool the player picked) in place of **Origin found**. Under **Games over time** come **Models per round**, a bar chart of rounds by pool size (2, 3-5, 6-10, 11-20, 21-50, 51+) with the bucket labels shown on a phone too, and **Most picked models**, a table of the 15 models that sat in the most pools: rounds and share of the finished Custom rounds. A model counts once per round. A round with no saved pool is left out of both.
- **All models** uses the same blocks for that category. A category with no games says **No games in this category yet.** It does not show a made-up rate
- **Category** shows the figures and the chart for the Category mode, then a **By category** table, then the rest of the blocks. The table is of the Category-mode rounds played on each category that is turned on (a category that is turned off is left out).
- **Company** shows the same layout for the Company mode, with a **By company** table of the Company-mode rounds played on each company that is turned on.

Tokens are prompt plus completion. Nothing on this page is a price.

## Profile (`/profile`)

Private. The account menu shows **Profile** once the player has a username. No session goes to `/login?next=/profile`. No username goes to `/welcome?next=/profile`. There is no id in the URL, so a player only opens their own page.

- Username field, same rules as welcome. **Save** updates the profile and every game row for that user id. The leaderboard follows. An empty name is rejected.
- **Picture.** Optional upload, JPEG, PNG, or WebP, at most 1 MB. A larger file or any other type shows **Use a JPEG, PNG, or WebP under 1 MB.** It replaces the generated mark in the header. People who skipped it on welcome add it here.
- Stats: games played, solved, failed, given up, solve rate, best score, average score, average messages on a solved game. On a phone these sit two across.
- Games: a filter row sits above the list: **Dates** (one button that opens a month calendar: the first click picks the first day, the second the last, UTC days, the last day included, and the range applies on the second click, with **Clear dates** inside), **Status** (All, Solved, Failed, Given up) and **Game mode** (All, then the modes this player has rounds in). A mode with a difficulty (Daily, All models) adds **Difficulty**, Category adds **Category** and Company adds **Company**, each listing only what this player has played. Origin and Custom add nothing. A change applies at once with no page reload: the list reloads below, back on page 1, and **Clear** shows while any filter is set. A filter with no rounds says **No games match these filters.** The cup marks the best score among the **solved** rounds the filter keeps, not only the ones on the page, so a failed or given-up round never takes it. The **Best score** figure above stays the overall one. 10 per page, **Previous** and **Next**. The closed row shows the date, then a chip for the game mode, a difficulty chip (a company or category round shows that name in a chip instead, in the same style), and a **No hints** chip when that round was played without hints, then the status and the score. On a phone the date is on its own line, and the status stays beside the score. The chip uses the same colours as the leaderboard. The game mode chip has the base gray, the company or category chip is a step lighter in dark mode and a step darker in light mode, and the **No hints** chip is one step further, on the profile and the leaderboard. A round stored with no difficulty has no difficulty chip. Clicking a row opens it in place, directly under that row, and clicking it again closes it. One row is open at a time. A finished round opens the same score card as the result page: the model, the score, the status, the game mode, the difficulty, the breakdown, **Share**, **Copy link**, and **Download card**. On a phone those three fill the width and **How scoring works** is not on the card. On a wide screen **How scoring works** stays. The title’s outline continues down both sides and across the bottom, at the same thickness, so the open row is one box. The model sits inside that line, in line with the date. It does not show **Play again** or **Leaderboard**, and it does not show the chat. The model stays on this card, including a Daily played today. **Share** uses the same message as the result page, so that Daily leaves the model out of the message until the next UTC day. Game mode is the category name. Difficulty is Easy, Medium, Hard, or Impossible, or **—** when the round stored none. A logo that fails to load is hidden. An open round hides the model and logo and links to **Continue**.
- **Change password.** A red-outlined **Change password** button in the top card, right of **Save** (on its own row on a phone), only for an account that signs in with a password (a Google-only account has none). It opens a card under the top card, and the button or **Cancel** closes it. Two fields, **Current password** and **New password** with the sign-up **Must contain** checklist, and **Change password**. The server checks the sign-up rules, then the current password, then saves. A wrong current password shows **The current password is not right.** The same password shows **Choose a password different from the current one.** The session stays signed in. On success the card closes, with no message.
- **Delete account.** A card under the games with the heading, the line saying what is removed, and a solid red **Delete account** button, centered on a desktop and the full width of the card on a phone. The button opens a window that says what is removed and asks the player to type `delete` (case and outer spaces ignored). **Cancel**, Escape, or a click outside closes it. The red **Delete account** button in the window stays disabled until the word matches, then submits. The same card and window are on `/account/delete`.

## Delete account (`/account/delete` and `/profile`)

The account menu does not link to delete. The form is on the profile page. `/account/delete` has the same card (without the heading) and window for a direct visit. No session goes to `/login?next=/account/delete`. There is no control that names another player.

The copy says this removes the profile and picture, and the name on the leaderboard. It does not say the games are removed. The server uses the session id. A user id in the form is ignored. It sets `user_id` and `username` to null on that user's games, and `user_id` to null on that user's usage rows. Messages and guesses stay on the games. The picture in the `avatars` bucket is removed, then the auth user is deleted, which removes the profile. If the anonymize step fails, the auth user stays. The session ends on `/`. On the profile page, an unchecked box shows **Confirm that you want to delete your account.** in place, without leaving the scroll position. On `/account/delete`, an unchecked box stays on that page with the same sentence. A failed delete stays there with **Could not delete this account.** `games.user_id` is nullable in the baseline migration, and the leaderboard skips those rounds.

## Not found

Any URL that does not exist, and any `/admin` URL for a visitor who is not the owner, shows the same page with a 404 status: a big 404, the line **Who's that page?**, a short fake chat in which the page refuses to be identified, and two links, **Back to the game** and **See the leaderboard**. It is not indexed. The copy never says whether a hidden URL exists.

## Private pages

`/admin` and `/admin/models` are linked from the account menu only when the signed-in Supabase user has `app_metadata.admin === true`. Players cannot write `app_metadata`. A missing flag matches nobody. The footer, the landing page, and every other session have no admin link. Anyone else, including a signed-out visitor and a player who edits their profile, gets the same not-found page as a missing URL. There is no role column and no client flag.

`/admin` shows six counts, centered in their cards: models in the roster, active models, players, games today (UTC, finished games, like the home page), total games, and total cost (every usage row). Players are distinct accounts that have started a game. Under them: games over time in every mode (like `/statistics` but with every started game, and an open round is the light rest of the bar), players per day, rounds per player, open and abandoned rounds by age, hint use, cost per mode, failed calls by model, and roster coverage. These are read with the server key after the check. They are not a public API. Solve rates and models are on the public Statistics page. Costs and each mode are on their own pages.

`/admin/costs` reads OpenRouter when the page loads. Three cards, in order: paid all time, paid last 30 days, paid last 7 days. There is no this-UTC-week card and no this-UTC-month card. Clicking a column title sorts that table in the browser: ascending, then descending, then back to the original order. All models stays the summary row. The ledger shows cost per game, ledger spend, and failed calls. Spend by hidden model is the model that was the answer in the game, from our ledger, highest cost first. The key stays on the server.

`/admin/modes` shows each game category, including one with zero games: games, open, finished, solved, solve rate, and give-ups. The Category mode is one row, not one per category.

The admin pages are `/admin`, `/admin/costs`, `/admin/modes`, `/admin/models`, `/admin/categories`, `/admin/companies`, `/admin/origins`, `/admin/providers`, and `/admin/chat`. Each is specified in [Admin](admin.md): the roster, categories, companies, origins, providers, and the owner chat. Scoring settings are not on these pages.

There is no pause switch, confusion page or transcript page.
