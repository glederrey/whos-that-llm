# Admin

This is the cockpit. It is not a role, and it is not in the navigation for anyone else.

`ADMIN_EMAIL` is a server env var, one address. On every `/admin` page and every `/api/admin` route, the server reads the session user from Supabase and compares that email, case-insensitive, to `ADMIN_EMAIL`.

- Match: the pages render, and the public header shows an **Admin** link.
- Anything else, including no session and an empty `ADMIN_EMAIL`: `notFound()`. The response looks like any other missing URL. There is no "forbidden" page and no admin link in the HTML.
- The email is never sent to the browser as configuration. The link is rendered by a server component after the check.

Sign in with that address. Google and email/password both work if the session email is the same one. A second person does not get access by editing `app_metadata` or their username.

## Pages

One home page for the picture, and the rest for the work. A subnav sits on every admin page: **Home, Models, Categories, Families, Stats, Rounds.** It is part of the admin layout, so it never appears on the public site.

| Page | What it is for |
|---|---|
| `/admin` | The picture. Spend, volume, and the pause switch |
| `/admin/models` | Add a model, or set `enabled` |
| `/admin/categories` | Show, hide, and create categories |
| `/admin/families` | The family trait list |
| `/admin/stats` | Confusion, reveals, solve rates |
| `/admin/rounds` | Transcripts, one round at a time |
| `/admin/rounds/[gameId]` | One transcript |

## Home (`/admin`)

The page you open to see if the game is fine. It does not edit the roster.

**Pause the game.** Sets `app_settings.paused`. While paused, starting a round and sending a message return `503` `paused`. A guess, a skip, a reveal, and a give-up still work, so a player who already has a reply can finish that turn. They cannot send the next message until the game is unpaused. The public lobby shows **The game is paused.** and disables Play. This is the switch for a runaway bill. The OpenRouter monthly cap remains the backstop if the process is down.

**Spend**, from `GET https://openrouter.ai/api/v1/key` next to our `usage` sums:

- Today, this UTC week, this UTC month, from OpenRouter and from our ledger
- The gap between the two
- The key cap, what remains, and how it resets
- Failed calls today (`cost_usd = 0`)

**Right now:**

- Rounds started today, solved today, open right now
- Players today, and players this hour
- The three models that cost the most today
- Models whose median `reasoning_tokens` over the last 50 calls is above 200. The home page lists them and links to Models. It does not flip `enabled` by itself.

Each block links to the page that can change the thing. Spend by model links to Models. A noisy model links to its row. "12 open rounds" links to Rounds filtered to open.

## Models (`/admin/models`)

Add, edit, and turn off. The column is `models.enabled`.

**Add.** A form: our id (slug), OpenRouter id, display name, company, family, size, open weights, reasoning, release date, `provider_settings`, list prices, latest flag. `enabled` starts false. Saving an enabled reasoning model with empty settings, or an enabled model with no release date, is rejected. Companies and families can be created from here if the dropdown does not have them yet. A logo is still a file in `public/logos/`. The form stores the path.

**Turn off.** The normal way to remove a model. `enabled = false`. It leaves every draw, the custom picker, and every pool category. The row stays. Rounds already played still show the name. A round already open keeps the model it drew, including one you just turned off, so a player in the middle of five messages is not stranded. New rounds will not draw it.

**Turn on.** Runs the checks above, then the model is eligible wherever it is a member.

**Delete the row.** Only when no game and no category points at it. Otherwise the button reads **Turn it off instead** and does nothing. Deleting a model that has been played would break history.

The table shows list price beside average `cost_usd` and average `reasoning_tokens`. Rows with `enabled = false` stay in the list, visually marked, so they are easy to turn back on.

`provider_settings` is a JSON textarea. The route rejects invalid JSON. It does not interpret the vendor's schema beyond "this object is what we pass through". Play one round and read `reasoning_tokens` before leaving a thinking model enabled.

## Categories (`/admin/categories`)

Two kinds.

**Built-ins** are seeded: All models, Company, Family, Region, Size, Latest, Daily, Origin, Custom. They have special screens (a company picker, three region buttons, the custom checklist). You can rename the card, edit the sentence, change `sort_order`, set `enabled` false, and edit `jackpot_multiplier` on the scored ones. You can turn `token_scored` on or off for a scored built-in. Daily starts on. The control is absent on Custom, and the route rejects it there. You cannot delete a built-in and you cannot change Custom to scored. Turning Daily off hides the card. Old daily rounds stay on the leaderboard as long as that category is scored and has finished games. A round already started keeps the flag it copied into `rules`.

**Pools** are the categories you create. A pool is a name, a sentence, a jackpot multiplier (default 1), a scored flag (default on), a token-scored flag (default off), and a checklist of models. The draw is uniform among the members that are currently `enabled`. Given chips follow the usual rule on that set. The player sees the name, the sentence, and the count. They do not see the member list before the round, or the category is a coin flip among names you just showed them. `token_scored` cannot be set while `scored` is false.

Create needs at least two member rows. They may be disabled. The lobby card stays disabled with **Not enough models** until two of them are enabled.

Turn a pool off to hide it. Delete a pool only when no game uses that category id. Otherwise turn it off. Deleting would orphan `games.category`.

Reorder with `sort_order`. The lobby follows that order and skips categories with `enabled = false`, and pools that cannot be formed.

A scored category gets a leaderboard tab once it has a finished scored round, even if you later turn the card off. An unscored category never gets a tab. Custom stays the built-in unscored mode where the player picks the models each time. A pool you mark unscored is the same idea with a fixed set and no checklist page.

## Families (`/admin/families`)

Families are a trait of a model (Opus, Sonnet), not a lobby card by themselves. The Family card is a built-in category. This page edits the trait list.

- Create: slug and display name. Slug is `^[a-z0-9-]{2,32}$`. It does not change later.
- Rename the display name.
- `enabled = false` hides that family inside the Family picker. Models keep the id.
- Delete only when no model references it.

## Stats (`/admin/stats`)

- Rounds started, solved, finished without the model, given up. Today and all time.
- Among rounds that did not solve: how many found each characteristic at least once.
- Reveals: how often each key is bought, and how often a round that bought it still solved.
- Messages used on solved rounds, 1 through 5.
- Solve rate by category and by model. Custom is its own row. Practice misses stay in the confusion matrix.
- Confusion matrix, wrong guesses only, and a company matrix beside it.
- Top pairs: **Sonnet 5.5 was called Sonnet 5 · 14**
- Players signed up, played today, played this hour.

## Rounds (`/admin/rounds`)

When, username, category, pool, model name, status, score, messages, cost, reasoning tokens. Filters for today, for open rounds, and for one model. Open a row for the transcript and each guess. This is how a model that says its own name gets caught. Check it after the first evening, and after any prompt change.
