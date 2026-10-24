# Admin

Ten pages, all behind one owner check: `/admin`, `/admin/costs`, `/admin/games`, `/admin/modes`, `/admin/categories`, `/admin/companies`, `/admin/origins`, `/admin/models`, `/admin/providers`, and `/admin/chat`. There is no other admin surface.

The server reads the signed-in Supabase user and allows admin only when `app_metadata.admin === true`. Players cannot write `app_metadata`. A profile edit cannot grant access. There is no role column and no client flag. A missing flag matches nobody.

- Match: those pages render. The account menu includes **Admin** for that session only. The item is rendered on the server. It is not a flag in client JavaScript.
- Anything else, including no session: `notFound()`. The response looks like any other missing URL. There is no "forbidden" page, no login wall, and no admin link in that HTML.
- The flag is not sent to the browser.

Google and email/password both work when that session has the flag. A second person does not get access by editing their username.

Roster changes are server actions. Each one repeats the check, then writes with the server key. anon and authenticated cannot insert, update, or delete `models`, `companies`, `categories`, or `model_categories`. The counts on `/admin` are not a public function.

A subnav sits on every admin page: **Stats, Costs, Games, Modes, Categories, Companies, Origins, Models, Providers, Chat.** (**Stats** is `/admin`.) It is part of the admin layout, so it never appears on the public site.

## Stats (`/admin`)

Five counts: models in the roster, active models, players, games today (UTC), and total games. Players are accounts that have started a game. The page does not load OpenRouter, and it does not list game results or modes.

## Costs (`/admin/costs`)

The money page.

- **OpenRouter spend**, read from OpenRouter on every load with `OPENROUTER_API_KEY` (a runtime variable, never baked at build time). `GET /api/v1/key` gives what that key has paid all time. `GET /api/v1/activity` gives requests, tokens, and spend per model for completed UTC days, and `POST /api/v1/analytics/query` adds the current UTC day, which activity leaves out. Last 30 days and last 7 days are those same rows, so a charge from today is in both windows and in the table. The table has seven columns (model, then paid, requests, and tokens for 7 and 30 days) and shows 10 rows per page. Clicking a column title sorts the model rows ascending, then descending, then back to the original order. All models stays the summary row. OpenRouter only serves activity to a management key and covers the whole account, so set `OPENROUTER_MANAGEMENT_KEY` if the game key is not one. Without it the page falls back to `OPENROUTER_API_KEY`. The key total and the per-model section fail on their own: the page says so in that section and still renders the rest.
- **Our ledger**: cost per game, ledger spend, and failed calls. Tokens and cost are the `usage` rows saved from each OpenRouter reply. This is not the OpenRouter bill above it.
- **Spend by hidden model**: the model that was the answer in the game. Requests, tokens, cost, and cost per game, from our ledger, all time, highest cost first. This table does not sort and has no paging.

The game pauses for everyone when OpenRouter returns 402 or an explicit credit error (`app_settings.paused`). No admin page flips that flag. After topping up credits on OpenRouter, clear `app_settings.paused` in the database. The site does not take a payment for credits.

## Games (`/admin/games`)

Play, without money columns: six figures (solve rate, give-ups, correct guesses, messages, tokens), a bar chart of games started per UTC day for 14 days with the solved part shaded, and which models are hardest to find (games, solve rate, messages when solved). That table does not sort.

## Modes (`/admin/modes`)

Read-only. One row per game mode, with games, open, finished, solved, solve rate, and give-ups. The Origin row shows a dash for give-ups. Nothing on this page edits a mode (see Game modes below).

## Companies (`/admin/companies`)

Read-only. Name, origin, and how many models the company has enabled. There is no create, edit, or logo form here. A company is created from the model form on `/admin/models`.

## Models (`/admin/models`)

Three sections, 10 rows per page each: **Active** (available and on), **Inactive** (available and off), and **Unavailable on OpenRouter**. One search box above them matches the model name, the company, or a category name (100 characters at most).

Columns: logo and name, company, origin, year, size, difficulty, input price, output price, categories, then the On/Off toggle and an Edit popover. Difficulty is the name: Easy, Medium, Hard, or Impossible, and the column sorts Easy to Impossible. Input and output are the live OpenRouter list price in dollars per 1 million tokens. They are not stored on the model. The page asks OpenRouter on each load, and a price shows a dash when OpenRouter has none or does not answer. Clicking a header sorts ascending, again descending, a third time clears the sort. Clicking a different column starts that column at ascending. The sort applies to all three sections and puts missing values last. The toggle and Edit are not a sort column. **On** is green. **Off** is red.

**Add.** Start with an OpenRouter id and press **Look up**. It fills the display name, the company when that org is one of ours, and the release date. Size, difficulty, and categories stay empty, because OpenRouter does not set them. The id of the model is a slug of the last part of the OpenRouter id. A new model is inserted off, with `reasoning` false, `open_weights` false, and empty `provider_settings`. Companies can be created from the form if the dropdown does not have them yet. The company form lists every origin, on or off, with the flag in front.

**Edit.** Name (1–80 characters), OpenRouter id, company (created if new, and its origin updated if changed), origin, release year (2010–2100) or date, size (nano up to xxl), difficulty, and categories as checkboxes from the categories that already exist. A model can be in several. Edit does not touch `reasoning`, `open_weights`, or `provider_settings`. Saving keeps the current search.

**On.** Refused, with a notice, when the model is unavailable on OpenRouter, has no release date, or is a reasoning model with empty `provider_settings`.

**Off.** The normal way to remove a model. `enabled = false`. It leaves every draw. The row stays. Rounds already played still show the name from `games.traits`. A round already open keeps the model it drew and the traits it froze, including one you just edited, so a player in the middle of ten messages is not rewritten. New rounds use the edited row. There is no delete.

**Check availability.** A button that reads the OpenRouter catalog and always applies the result (see the Availability API below).

**Search for new models.** Lists text models created on OpenRouter in the last 30 days that are not on the roster. Each card asks for a size and a difficulty. **Add models** inserts the picked ones (200 at most) as off.

Play one round and read `reasoning_tokens` on `/admin/costs` before leaving a thinking model enabled.

### Availability API

`POST /api/admin/availability` lets a bot run the daily model-availability check without a session. It uses the same code as the **Check availability** button.

**What it does.** It reads the whole OpenRouter catalog, then compares it with the roster. Models with `available = true` that the catalog lacks are **newly unavailable**. Models with `available = false` that the catalog lists again are **back available**.

**Dry run by default.** A plain call writes nothing and only reports. Only the query `?apply=true` (exactly that value; `1`, `TRUE`, or anything else is a dry run) writes. An apply fetches the catalog again and runs the guard again. It never trusts an earlier dry run. A write does three things: newly unavailable models get `available = false` and `enabled = false`; back-available models get `available = true` and nothing else; `reasoning` flags are refreshed from the catalog, as the button does.

**The endpoint can only mark models unavailable or available. It never turns a model on.** A returning model keeps `enabled = false` (the database constraint `models_unavailable_stays_off` also requires that while it is unavailable). You turn it on by hand on Models.

**Flow.** The bot calls the dry run every day and reports what it would change. You read the report, then apply with the `?apply=true` curl below or with the **Check availability** button, which always applies. Running an apply twice in a row changes nothing the second time.

Anyone who holds the token can apply. The dry-run default guards against mistakes. It is not an auth boundary. There is no rate limit.

**Response** (`200`):

```json
{
  "applied": false,
  "checked": 120,
  "newlyUnavailable": [{ "id": "some-model", "openrouterId": "org/some-model", "name": "Some Model" }],
  "backAvailable": [{ "id": "other-model", "openrouterId": "org/other-model", "name": "Other Model" }]
}
```

`checked` is the number of roster models. `applied` is true only after an apply.

**The guard.** The call answers `502` with `{ "error": "..." }` and writes nothing when any catalog page fails, the catalog is empty, or the catalog has fewer than 70% of the roster's available-model count (exactly 70% passes). A write that fails in the database answers `500`.

**Auth.** `Authorization: Bearer <token>`, compared in constant time with `AVAILABILITY_TOKEN`. A missing header, a wrong token, or an unset `AVAILABILITY_TOKEN` all answer `404` with no body, like any admin route. The token is never logged.

**Generate the token.** `openssl rand -hex 32`

**Where to set it.** Vercel project env var `AVAILABILITY_TOKEN` for Production, and the bot's secret store. For dev, put it in `.env.development.local`. `.env.example` lists the name with an empty value. Never commit the value.

**Rotate it.** Generate a new value, set it in both places (Vercel and the bot's secret store), and redeploy. The old token stops working on the redeploy.

**Examples** (placeholder token):

```sh
# Dry run: report only
curl -X POST -H "Authorization: Bearer $AVAILABILITY_TOKEN" https://<site>/api/admin/availability

# Apply: write the changes
curl -X POST -H "Authorization: Bearer $AVAILABILITY_TOKEN" "https://<site>/api/admin/availability?apply=true"
```

## Providers (`/admin/providers`)

Two tables, **Blacklisted** and **Trusted**, both sortable, 10 rows per page. The only action is **Deblacklist**, which sets a blacklisted provider back to trusted. There is no way to blacklist a provider by hand on this page.

## Chat (`/admin/chat`)

Pick a roster model (search by name or company) and talk to it. The thread is not saved and is not a game. Each send goes to `POST /admin/chat/send`, which checks the owner, validates the body, and streams the reply (words, then a final event with the token counts, the provider, and the input that was sent). **Show tokens** and **Show input** toggle that detail. A model with no OpenRouter id answers `404`.

## Game modes (database)

The built-ins are seeded: Daily, All models, Company, Category (`class`), Origin, Custom. Latest and Family are not rows. Size is not a row. Daily, All models, Company, and Category are enabled with a leaderboard and hints. Origin is enabled with no leaderboard and no hints. Custom is enabled with no leaderboard and hints. The flags (`enabled`, `leaderboard`, `hints_allowed`, `blurb`, `sort_order`) are edited in the database. No admin page edits them. You cannot delete a built-in.

Turning a mode off hides its card. Old rounds stay on the leaderboard as long as that mode has `leaderboard` and has counted games. A round already started keeps the `rules.hintsAllowed` it copied. The score formula is the one in [Rules](rules.md), frozen onto the round. A mode has no multiplier of its own.

## Origins (`/admin/origins`)

The list of origins a company can have. Each row shows the flag, the name, the number of companies that use it, and an On/Off button, with an inline Edit form. The owner can:

- **Add** an origin: a name (1–40 characters), one flag emoji, and an order (a whole number from 0 to 9999, 100 by default). The id comes from the name (`Latin America` is `latin-america`). A taken id says so.
- **Edit** the name, the flag, and the order. The id never changes.
- **Turn off or on.** Off, the origin has no button in the Origin game and none of its models is drawn there. Nothing else changes: the other modes, the origin hint, and past rounds stay as they are.

There is no delete. An origin that was used stays in the table for good, because companies and guesses point to it.

## Categories (`/admin/categories`)

Create, edit, and turn on or off. There is no delete: turning a category off keeps its games and history. The fields are:

- **Name**, required, 1–80 characters. The id is a slug taken from the name when the row is created, and a rename does not change it.
- **Description**, short, at most 140 characters. Players see it in the Category dropdown on `/play`.
- **Models**, the same picker as the Custom card, in the same form (Add and Edit): a search box (case-insensitive, matches the model name or the company name), and every model in one row grouped by company (the header has the logo, name, origin with its flag, the picked count, and **Add all** or **Drop all**; a row has a check circle, the name, and the year and size). A button under the list says "N selected" and opens a window with the picks split by company, each with a red button with a white cross to remove it, plus **Clear all** and **Done**. A model that is turned off can be selected; it shows an "off" tag, and it does not count in the Models column until it is turned on. A model the filter hides stays selected and is still saved. Edit starts with the category's current models, Add starts empty. Save writes only the links that changed (the same `model_categories` rows the model form edits, so both directions stay in sync), and an unknown model id is refused. If linking fails on Add, the new category is taken back out so no half-made row stays.
- **Icon**, computed on save, no radio. The first one filled wins: an **uploaded image** (an SVG, PNG, or WebP of at most 1 MB; an SVG with a script, an event handler, `javascript:`, or embedded content anywhere in the file is refused, stored in the `logos` bucket under `categories/`), then an **emoji** (exactly one emoji, which can be a keycap or a flag; a Pick button that opens a searchable emoji grid above the button, so the dialog does not grow, with a preview of the choice and no text field, loaded on first open and served from `public/emoji-data/`, never a third-party CDN; `npm run emoji:copy` refreshes that file after bumping `emoji-picker-element-data`; the picker grid draws the OS emoji font, so on Windows a flag shows as letters there, and the preview beside the button shows the choice the way the site will draw it), then the **company logo** (a select of the companies), then the **default**, the Who's that LLM logo. The form says so in one hint line. On edit it shows the current icon. An emoji icon is drawn everywhere as a [Twemoji](https://github.com/jdecked/twemoji) picture, never as text, so a flag looks the same on every OS (Windows has no flag glyphs): `<img>` pointing at `/emoji/<code>` (the lowercase hex code points joined by `-`, `fe0f` dropped unless the emoji has a joiner), served by `app/emoji/[code]/route.ts` from the pinned `@twemoji/svg` package with a one-year immutable cache, 404 for an unknown code. If the picture fails to load, the text emoji shows. The stored value stays the emoji itself. An image or emoji already stored stays unless a new one is given or **Remove current icon** is ticked, which falls back to the company logo or the default and, best effort, deletes the stored image.

Like Models, the page has two tables, **Active** and **Inactive**, with an **OFF**/**ON** button per row. A category that is off is not on the play page, not startable (the start route answers 404), not in the leaderboard Category dropdown, and left out of the statistics. It keeps its models, links, and games; past games stay in profile history with the name. Each table shows the icon, name, description, and the count of models that are turned on. The model form attaches existing categories. It does not create them. A model can be in Opus and in Latest Anthropic at the same time.

Upload is a server action that repeats the owner check. It sniffs the bytes (`readLogo`), not the file name. A category needs at least two turned-on models before players can pick it.
