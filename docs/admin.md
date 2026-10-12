# Admin

This build has six pages: `/admin`, `/admin/costs`, `/admin/games`, `/admin/modes`, `/admin/models`, and `/admin/classes`. The rest of this document is the later cockpit.

The server reads the signed-in Supabase user and allows admin only when `app_metadata.admin === true`. Players cannot write `app_metadata`. A profile edit cannot grant access. There is no role column and no client flag. A missing flag matches nobody.

- Match: those pages render. The account menu includes **Admin** for that session only. The item is rendered on the server. It is not a flag in client JavaScript.
- Anything else, including no session: `notFound()`. The response looks like any other missing URL. There is no "forbidden" page, no login wall, and no admin link in that HTML.
- The flag is not sent to the browser.

Google and email/password both work when that session has the flag. A second person does not get access by editing their username.

Roster changes are server actions. Each one repeats the check, then writes with the server key. anon and authenticated cannot insert, update, or delete `models`, `companies`, `classes`, or `model_classes`. The counts on `/admin` are not a public function.

A subnav sits on every one of those pages: **Stats, Costs, Games, Modes, Models, Classes.**

`/admin` is the headline. It shows five counts: models in the roster, active models, players, games today (UTC), and total games. Players are accounts that have started a game. It does not load OpenRouter, and it does not list game results or modes.

`/admin/costs` is the money page.

- **OpenRouter spend**, read from OpenRouter on every load with `OPENROUTER_API_KEY` (a runtime variable, never baked at build time). `GET /api/v1/key` gives what that key has paid all time. `GET /api/v1/activity` gives requests, tokens, and spend per model for completed UTC days, and `POST /api/v1/analytics/query` adds the current UTC day, which activity leaves out. Last 30 days and last 7 days are those same rows, so a charge from today is in both windows and in the table. Clicking a column title sorts the model rows ascending, then descending, then back to the original order. All models stays the summary row. OpenRouter only serves activity to a management key and covers the whole account, so set `OPENROUTER_MANAGEMENT_KEY` if the game key is not one. The key total and the per-model section fail on their own: the page says so in that section and still renders the rest.
- **Our ledger**: cost per game, cost per solved game, ledger spend, and failed calls. Tokens and cost are the `usage` rows saved from each OpenRouter reply. This is not the OpenRouter bill above it.
- **Spend by hidden model**: requests, tokens, cost, and cost per game, highest cost first.

`/admin/games` is play, without money columns: solve rate, give-ups, correct guesses, messages, tokens, games started per UTC day for 14 days, and which models are hardest to find (games, solve rate, messages when solved).

`/admin/modes` is one row per game category, including a category with zero games, plus any extra category id already stored on a game. Each row has games, open, finished, solved, solve rate, and give-ups. A class leaderboard is not a row on this page. The class game mode is not built.

`/admin/models` shows the display name, company, region, year, size, difficulty, input price, output price, then the classes, then active. Difficulty is the name: Easy, Medium, Hard, or Impossible. The column sorts Easy to Impossible. Input and output are dollars per 1 million tokens. Clicking one of those headers sorts both tables ascending. Clicking it again sorts descending. A third click clears the sort and returns the default order. Clicking a different column starts that column at ascending. The turn-on and edit controls are not a sort column. Saving an edit keeps the current search. **Reset** shows only while a search is active and clears it. Add starts with an OpenRouter id. The lookup fills the display name, the company when that org is one of ours, the release date, and the two prices. Size, difficulty, and classes stay empty. OpenRouter does not set the difficulty. A new model stays off. Class membership is a set of checkboxes from the classes that already exist, and a model can have more than one. **On** is green. **Off** is red.

`/admin/classes` creates and edits a class: name, description, and an optional company. There is no logo field. The class game mode is not on this page.

The game still pauses for everyone when OpenRouter returns 402 or an explicit credit error. The pause switch on this page is later. Until then, clear `app_settings.paused` in the database after topping up credits on OpenRouter. The site does not take a payment for credits.

When the rest of this cockpit exists, it is still not a role, and it is still not in the navigation.

## Pages

One home page for the picture, and the rest for the work. A subnav sits on every admin page: **Home, Models, Categories, Stats, Rounds.** It is part of the admin layout, so it never appears on the public site.

| Page | What it is for |
|---|---|
| `/admin` | The picture. Spend, volume, and the pause switch |
| `/admin/models` | Add a model, or set `enabled` |
| `/admin/categories` | Show or hide categories |
| `/admin/stats` | Confusion, hints, solve rates |
| `/admin/rounds` | Transcripts, one round at a time |
| `/admin/rounds/[gameId]` | One transcript |

## Home (`/admin`)

The page you open to see if the game is fine. It does not edit the roster.

**Pause the game.** Sets `app_settings.paused`. While paused, starting a round and sending a message return `503` `paused`. A guess, a hint, and a give-up still work, so a player who already has a reply can finish that turn. They cannot send the next message until the game is unpaused. The public lobby shows **The game is paused.** and disables Play. This is also the flag a credit error sets. The OpenRouter monthly cap remains the backstop if the process is down.

**Spend**, from `GET https://openrouter.ai/api/v1/key` next to our `usage` sums:

- Today, this UTC week, this UTC month, from OpenRouter and from our ledger
- The gap between the two
- The key cap, what remains, and how it resets
- Failed calls today (`cost_usd = 0`)

**Right now:**

- Rounds started today, solved today, misses today, open right now
- Players today, and players this hour
- The three models that cost the most today
- Models whose median `reasoning_tokens` over the last 50 calls is above 200. The home page lists them and links to Models. It does not flip `enabled` by itself. That column is a cost fact. It is not a trait the player sees.

Each block links to the page that can change the thing. Spend by model links to Models. A noisy model links to its row. "12 open rounds" links to Rounds filtered to open.

## Models (`/admin/models`)

Add, edit, and turn off. The column is `models.enabled`.

**Add.** A form: our id (slug), OpenRouter id, display name, company, classes, size, open weights, reasoning, release date, `provider_settings`, list prices. There is no latest flag. `enabled` starts false. Saving an enabled reasoning model with empty settings, or an enabled model with no release date, is rejected. Companies can be created from here if the dropdown does not have them yet. Classes are chosen from `/admin/classes`. They are not typed in as a new name on this form.

Open weights and reasoning are stored on the model as admin facts. Play does not use them. Size and release year are hints in All models and Daily. They are not points. Region does not offer hints.

**Logo.** Upload the company logo to the public `logos` bucket as `{company_id}.png` (PNG, SVG, or WebP, at most 1 MB). The row stores `logos/{company_id}.png` on `companies.logo_path`, or a model override on `models.logo_path`. If the upload is unavailable, paste an `https` URL instead. A model logo overrides the company logo.

**Off.** The normal way to remove a model. `enabled = false`. It leaves every draw. The row stays. Rounds already played still show the name from `games.traits`. A round already open keeps the model it drew and the traits it froze, including one you just edited, so a player in the middle of ten messages is not rewritten. New rounds use the edited row.

**On.** Runs the checks above, then the model is eligible wherever its company, region, or classes put it.

**Delete the row.** Only when no game points at it. Otherwise the button reads **Turn it off instead** and does nothing. Deleting a model that has been played would break the foreign key. History still reads `games.traits` for the values.

The table shows list price beside average `cost_usd` and average `reasoning_tokens`. Rows with `enabled = false` stay in the list, visually marked, so they are easy to turn back on.

`provider_settings` is a JSON textarea. The route rejects invalid JSON. It does not interpret the vendor's schema beyond "this object is what we pass through". Play one round and read `reasoning_tokens` before leaving a thinking model enabled.

## Categories (`/admin/categories`)

The built-ins are seeded: Daily, All models, Class, Company, Region, Custom. Latest, Origin, and Family are not rows. Size is not a row. All models starts enabled. The others start disabled. Class is that disabled card, before Company.

You can rename the card, edit the sentence, change `sort_order`, and set `enabled`. You can set `leaderboard` and `hints_allowed`. The seed already matches [Rules](rules.md): leaderboards for All models and Daily, hints only for Daily, All models, and Custom. Company, region, latest, and every other category have hints off. Custom has no leaderboard. A class leaderboard is one board per class, and it is not built. You cannot delete a built-in.

Turning Daily off hides the card. Old daily rounds stay on the leaderboard as long as that category has `leaderboard` and has counted games. A round already started keeps the `rules.hintsAllowed` it copied.

The score formula is the one in [Rules](rules.md), frozen onto the round. Categories do not have their own multiplier.

The player sees the name and the sentence. On a pool picker they also see the count. They do not see the member list before the round.

Reorder with `sort_order`. The lobby follows that order and leaves out categories with `enabled = false`.

## Classes (`/admin/classes`)

Create and edit. The fields are name, description, and an optional company. The id is a slug taken from the name when the row is created, and a rename does not change it. Leave the company blank for a class that is not one lab, such as GPT vs Claude. There is no logo column.

The model page attaches existing classes. It does not create them. A model can be in Opus and in Latest Anthropic at the same time.

This page does not start a round, and it does not show a leaderboard. When the class mode is built, each class has its own leaderboard, and that mode has no hints.

## Stats (`/admin/stats`)

- Rounds started, solved, missed, given up. Today and all time.
- Among misses: how many found company and region at least once.
- Hints: how often year and size are bought, and how often a round that bought one still solved.
- Messages used on solved rounds, 1 through 5.
- Solve rate by category and by model.
- Confusion matrix, wrong model guesses only, and a company matrix beside it.
- Top pairs: **Sonnet 5.5 was called Sonnet 5 · 14**
- Players signed up, played today, played this hour.

## Rounds (`/admin/rounds`)

When, username, category, pool, model name, status, score, messages, cost, reasoning tokens. Filters for today, for open rounds, and for one model. Open a row for the transcript and each guess. This is how a model that says its own name gets caught. The same rows stay after that check. They are the chat dataset, joined to the round by `games.id`. Check it after the first evening, and after any prompt change. The score on a give-up is shown here even though that round is off the leaderboard. A negative score is shown as stored.
