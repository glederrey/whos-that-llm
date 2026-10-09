# Overview

A chat game. A hidden model answers. The player has five messages to figure out which model it is. Each message earns one guess. A guess pays for every characteristic it gets right. Naming the exact model pays a jackpot on top. Revealing a characteristic the guess missed costs points. Every guess is stored, so we can see which models get confused with which.

The name on the site is **Who's that LLM**.

## Stack

| Piece | Role |
|---|---|
| Next.js on Node 22 | The site, and the only code that talks to a model |
| Vercel AI SDK `ai` v7 and `@openrouter/ai-sdk-provider` | One call shape for every model |
| Supabase Auth | Google and email/password, same user table |
| Supabase Postgres | Catalog, games, guesses, cost ledger |
| OpenRouter | One API key, one bill, US / EU / CN models |
| Vercel Hobby | Hosting, HTTPS, a `*.vercel.app` URL |
| A Python notebook later | Charts the admin page does not have |

The browser never receives the OpenRouter key, the Supabase service role key, or the hidden model id of an active round.

Pages and route handlers are one Next.js app. The handlers are the backend: they hold the keys, call OpenRouter, and write the game. There is no second server. A split would add another deploy and another hop on every message, for a site with one client. Supabase is the database and the login, not an application server. The Python notebook stays outside, for charts.

## Hosting

A push to GitHub builds the site on Vercel, runs the server routes, and serves HTTPS. Hobby is free. A function may run for several minutes, which covers a reply. There is no machine to patch.

The game is on a `something.vercel.app` address before any domain exists. Buy a domain when the game is worth showing. In the Vercel project, Settings → Domains, add the name. At the registrar, add the records Vercel shows:

- an **A** record for the bare name (`whosthatllm.com`)
- a **CNAME** for `www`, aimed at the target Vercel gives that project

Leave the nameservers at the registrar. Vercel issues the certificate once the records propagate. A domain is about ten to fifteen francs a year. The API bill is the cost that matters.

## Accounts

No VPS, no extra email service, no second database.

| What | What to do | When |
|---|---|---|
| **GitHub** | Already exists: `glederrey/whos-that-llm`. Vercel deploys from it. | Done |
| **Supabase** | One project. Copy the project URL, the anon key, and the service role key. Turn on Email and Google under Authentication. | Before auth works |
| **Google Cloud** | One project on the existing Google account. No billing. OAuth client (Web). Authorized redirect: `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the id and secret into the Supabase Google provider. | Before the Google button works |
| **OpenRouter** | Account, about $10 of credit, one API key, a monthly cap around $20. The key stays in env vars. | Before the first real model call |
| **Vercel** | Sign up with GitHub. Hobby. Paste the env vars from [Build](build.md). | When the app runs locally |
| **Ko-fi** | One page for tips. Stay on the free setting, so a one-time tip pays no Ko-fi fee. Connect Stripe. Set the page currency to euros. Paste the page URL into `tipUrl`. | Before the footer shows **Tip** |
| **Domain registrar** | Buy the name and add the two DNS records. | After someone besides us is playing |

Ko-fi does not price a page in francs, so euros avoids a second conversion on a European card. Stripe pays out to the Swiss account. A tip is not an account on this site, and it buys nothing in the game. The API bill stays on the OpenRouter cap until tips actually cover it.

Supabase sends confirmation and password-reset mail. That quota is enough to start. Custom SMTP is the fix if those emails start failing.

Admin is not a role you hand out. `ADMIN_EMAIL` in the server env is the one address that can open `/admin`. Sign in with that address (Google or email/password, as long as the session email matches). Everyone else gets the same 404 as a missing page, and the site renders no Admin link for them. An empty `ADMIN_EMAIL` means there is no admin.

## Auth

Both methods stay on, and both write into `auth.users`. Link identities that share an email, so one person does not get two accounts.

Email confirmation stays on. The first session with no username goes to `/welcome`. Usernames are 3–20 characters, `[A-Za-z0-9_]`, unique. Reject `admin`, `system`, `who`, and `llm`. The profile name is what the leaderboard shows today. The game row keeps a copy from the moment the round started, so a rename does not rewrite history.

## Limits the player can see

These three are on the landing page, the lobby, the rules, and the round.

| Limit | Value | On screen |
|---|---|---|
| Messages in a round | **5** | `Message 2 of 5` |
| Guesses | **1 per message** | `Guess for message 2`, after the reply |
| Games | **10 per rolling hour** | `4 of 10 this hour`, plus when the next slot frees |

Also:

- A user message is at most **500 characters**. The input shows the counter.
- The assistant reply is capped at **500 output tokens**. The server clamps this. Nothing in the database can raise it.
- One open round per account. The lobby offers Continue.
- The daily model is once per account per UTC day, and it counts toward the 10.

The hourly check and the insert run in one transaction. Two tabs cannot both take the last slot.

## What a round costs

Five replies are 2,500 output tokens, plus the growing transcript on the way in, plus whatever the low reasoning setting still emits. October 2026 list prices, for a full round:

| Tier | Examples | About one full round |
|---|---|---|
| Small | Haiku 5.5, a small GPT, DeepSeek Flash | under 1 cent |
| Medium | Sonnet 5.5, GPT-5.6 Sol | about 5 cents |
| Large | Opus 5.5 | about 10 cents, more if reasoning tokens stay high |
| Leave out | Fable | several times an Opus round |

Ten Opus rounds in an hour is about a dollar for that player. The OpenRouter monthly cap is the backstop. Every call stores `cost_usd` and `reasoning_tokens`. A model whose "lowest" effort still spends heavily gets disabled from the admin page.
