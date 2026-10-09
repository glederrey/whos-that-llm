# Who's that LLM

A guessing game in the spirit of Who's that Pokémon. A hidden language model answers in a chat. The player has five messages. After each reply they name one model, or give up. Naming the model is worth a base of 1000. If they never name it, the base is 100 for the right region and 300 for the right company. Year and size are hints, not points.

The first build is **All models**. The other categories are in the spec and come later.

The game is not built yet. The spec is in [`docs/`](docs/README.md). That spec is not a public page on the site.

Stack, when the code starts: Next.js, Supabase (auth and Postgres), OpenRouter, hosted on Vercel.
