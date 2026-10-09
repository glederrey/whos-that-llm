# Who's that LLM

A guessing game in the spirit of Who's that Pokémon. A hidden language model answers in a chat. The player has five messages. After each reply they name one model, or give up. Naming the model is worth a base of 1000. If they never name it, the base is 100 for the right region and 300 for the right company. Year and size are hints, not points.

The first build is **All models**. The other categories are in the spec and come later.

The spec is in [`docs/`](docs/README.md). That spec is not a public page on the site.

The first playable build is All models, with three small models enabled: Claude Haiku 5.5, GPT-5.6 Luna, and DeepSeek V4 Flash. Other categories, the profile, and admin come later.

## Run it locally

1. `npm install`
2. In the Supabase SQL editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) once.
3. Put the keys in `.env.local`. The names are in [`.env.example`](.env.example). Do not commit that file.
4. In Supabase Auth, set the site URL and the redirect URLs to the site root, including `http://localhost:3000/` for local play. Confirmation and password reset both return to `/`.
5. `npm run dev`, then open `http://localhost:3000`.

Sign up, pick a username, and start an All models round. A credit error from OpenRouter pauses the game for everyone. Top up, then set `app_settings.paused` back to false in the database. There is no admin screen yet.

Stack: Next.js, Supabase (auth and Postgres), OpenRouter, hosted on Vercel later.
