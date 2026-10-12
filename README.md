# Who's that LLM?

A guessing game in the spirit of Who's that Pokémon. A hidden language model answers in a chat. The player has ten messages. They can name a model after a reply, send another message, or give up. Naming the model is worth a base of 2000. If they never name it, the base is 100 for the right region and 300 for the right company. A wrong name costs 100, and company, region, year, and size are hints that cost 600, 400, 100, and 100. Penalties come off the base, then the token factor (10,000 divided by the tokens used, capped at 10) applies, then 2× for a no-hint round. The score is rounded and never below 0.

The first build is **All models**. The other categories are in the spec and come later.

The spec is in [`docs/`](docs/README.md). That spec is not a public page on the site.

The first playable build is All models, with six small models enabled: Claude Haiku 4.5, Claude Haiku 5.5, GPT-5.6 Luna, GPT-5.6 Luna Pro, GPT-6 Luna, and DeepSeek V4 Flash. Opus, Sonnet, the larger GPTs, DeepSeek Pro, and Mistral stay off. Other categories come later.

## Run it locally

1. `npm install`
2. In the Supabase SQL editor, run [`supabase/v0.1.sql`](supabase/v0.1.sql) once. That script is the baseline for a fresh database. It already includes the migrations through `0024`. Then run all the migration scripts in [`supabase/migrations/`](supabase/migrations/) starting with `0025`, in filename order.
3. Put the keys in `.env.local`. The names are in [`.env.example`](.env.example). Do not commit that file.
4. In Supabase Auth, set the site URL and the redirect URLs to the site root, including `http://localhost:3000/` for local play. Confirmation and password reset both return to `/`.
5. `npm run dev`, then open `http://localhost:3000`.

Sign up, pick a username, and start an All models round. A credit error from OpenRouter pauses the game for everyone. Top up, then set `app_settings.paused` back to false in the database. The owner account sees **Admin** in the account menu, which opens `/admin`. Other accounts do not see that link, and those URLs look like a missing page. A signed-in player can delete only their own account from the profile page, after confirming. An unchecked click stays on the page. That removes their profile and their name on the leaderboard. Their rounds stay, without their name. The app does not apply the SQL files.

Stack: Next.js, Supabase (auth and Postgres), OpenRouter, hosted on Vercel later.
