# Admin

This build has two pages, `/admin` and `/admin/models`. The rest of this document is the later cockpit.

The server reads the signed-in Supabase user and compares that email, case-insensitive, to `ADMIN_EMAIL`. A profile edit cannot grant access. There is no role column and no client flag. An empty `ADMIN_EMAIL` matches nobody.

- Match: the two pages render. The account menu includes **Admin** for that session only. The item is rendered on the server. It is not a flag in client JavaScript.
- Anything else, including no session: `notFound()`. The response looks like any other missing URL. There is no "forbidden" page, no login wall, and no admin link in that HTML.
- `ADMIN_EMAIL` is not sent to the browser.

Google and email/password both work when the session email matches `ADMIN_EMAIL`. A second person does not get access by editing `app_metadata` or their username.

Roster changes are server actions. Each one repeats the check, then writes with the server key. anon and authenticated cannot insert, update, or delete `models`, `companies`, or `families`. The counts on `/admin` are not a public function.

`/admin` also lists each roster model's public OpenRouter prompt and completion price, per million tokens, matched on the OpenRouter id. The request is `GET https://openrouter.ai/api/v1/models` with no API key. A missing model shows **No price**. A failed request says the prices could not be loaded.

`/admin/models` shows the display name and the family beside company, region, year, size, OpenRouter id, and active. Add and edit include the family. **Turn on** is green. **Turn off** is red.

The game still pauses for everyone when OpenRouter returns 402 or an explicit credit error. The pause switch on this page is later. Until then, clear `app_settings.paused` in the database after topping up credits on OpenRouter. The site does not take a payment for credits.

When the rest of this cockpit exists, it is still not a role, and it is still not in the navigation.

## Pages

One home page for the picture, and the rest for the work. A subnav sits on every admin page: **Home, Models, Categories, Families, Stats, Rounds.** It is part of the admin layout, so it never appears on the public site.

| Page | What it is for |
|---|---|
| `/admin` | The picture. Spend, volume, and the pause switch |
| `/admin/models` | Add a model, or set `enabled` |
| `/admin/categories` | Show or hide categories, and turn a family leaderboard on later |
| `/admin/families` | The family list |
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

**Add.** A form: our id (slug), OpenRouter id, display name, company, family, size, open weights, reasoning, release date, `provider_settings`, list prices, latest flag. `enabled` starts false. Saving an enabled reasoning model with empty settings, or an enabled model with no release date, is rejected. Companies and families can be created from here if the dropdown does not have them yet.

Open weights and reasoning are stored on the model as admin facts. Play does not use them. Size and release year are hints in All models, Region, and Daily. They are not points.

**Logo.** Upload the company logo to the public `logos` bucket as `{company_id}.png` (PNG, SVG, or WebP, at most 1 MB). The row stores `logos/{company_id}.png` on `companies.logo_path`, or a model override on `models.logo_path`. If the upload is unavailable, paste an `https` URL instead. A model logo overrides the company logo.

**Turn off.** The normal way to remove a model. `enabled = false`. It leaves every draw. The row stays. Rounds already played still show the name from `games.traits`. A round already open keeps the model it drew and the traits it froze, including one you just edited, so a player in the middle of ten messages is not rewritten. New rounds use the edited row.

**Turn on.** Runs the checks above, then the model is eligible wherever its company, family, region, or latest flag puts it.

**Delete the row.** Only when no game points at it. Otherwise the button reads **Turn it off instead** and does nothing. Deleting a model that has been played would break the foreign key. History still reads `games.traits` for the values.

The table shows list price beside average `cost_usd` and average `reasoning_tokens`. Rows with `enabled = false` stay in the list, visually marked, so they are easy to turn back on.

`provider_settings` is a JSON textarea. The route rejects invalid JSON. It does not interpret the vendor's schema beyond "this object is what we pass through". Play one round and read `reasoning_tokens` before leaving a thinking model enabled.

## Categories (`/admin/categories`)

The built-ins are seeded: All models, Company, Family, Region, Latest, Daily, Origin. Size is not a row. All models starts enabled. The others start disabled.

You can rename the card, edit the sentence, change `sort_order`, and set `enabled`. You can set `leaderboard` and `hints_allowed`. The seed already matches [Rules](rules.md): leaderboards for All models and Daily, hints off for Company, Family, Latest, and Origin. Turning a main family's leaderboard on is a later choice, not the seed. You cannot delete a built-in.

Turning Daily off hides the card. Old daily rounds stay on the leaderboard as long as that category has `leaderboard` and has counted games. A round already started keeps the `rules.hintsAllowed` it copied.

The score formula is the one in [Rules](rules.md), frozen onto the round. Categories do not have their own multiplier.

The player sees the name and the sentence. On a pool picker they also see the count. They do not see the member list before the round.

Reorder with `sort_order`. The lobby follows that order and leaves out categories with `enabled = false`.

## Families (`/admin/families`)

Families are a trait of a model (Opus, Sonnet), not a point trait. The Family card is a later category. This page edits the trait list.

- Create: slug and display name. Slug is `^[a-z0-9-]{2,32}$`. It does not change later.
- Rename the display name. New games pick up the new name. Frozen rounds keep the name in `games.traits`.
- `enabled = false` hides that family inside the Family picker. Models keep the id.
- Delete only when no model references it.

Family pays nothing. Feedback can still say **Same family.** A company pool for a lab with real families, such as Anthropic, uses that split. An OpenAI pool that shares one family is name-the-model only.

## Stats (`/admin/stats`)

- Rounds started, solved, missed, given up. Today and all time.
- Among misses: how many found company, region, and family at least once. Family is a count, not points.
- Hints: how often year and size are bought, and how often a round that bought one still solved.
- Messages used on solved rounds, 1 through 5.
- Solve rate by category and by model.
- Confusion matrix, wrong model guesses only, and a company matrix beside it.
- Top pairs: **Sonnet 5.5 was called Sonnet 5 · 14**
- Players signed up, played today, played this hour.

## Rounds (`/admin/rounds`)

When, username, category, pool, model name, status, score, messages, cost, reasoning tokens. Filters for today, for open rounds, and for one model. Open a row for the transcript and each guess. This is how a model that says its own name gets caught. The same rows stay after that check. They are the chat dataset, joined to the round by `games.id`. Check it after the first evening, and after any prompt change. The score on a give-up is shown here even though that round is off the leaderboard. A negative score is shown as stored.
