# Overview

A chat game. A hidden model answers. The player has ten messages. They can name a model after a reply, or send the next message with no guess, or give up. Naming the model sets the base to 1000, and that is the maximum base. If they never name it, the base is 100 for the region and 300 for the company, when those matched. A wrong model name subtracts 50 after the multipliers. Year and size can be bought as hints. They add no points.

The name on the site is **Who's that LLM?**.

## First build

**All models** is the game to build first. One site. A player signs up or logs in before they can play. They get ten messages, a word-by-word reply, an optional guess, year and size hints, no-hint mode, and a result page.

The playable roster is six small models: Claude Haiku 4.5, Claude Haiku 5.5, GPT-5.6 Luna, GPT-5.6 Luna Pro, GPT-6 Luna, and DeepSeek V4 Flash. Every other seeded model stays off. OpenRouter lists no other small Anthropic model, so Haiku 4.5 is the only extra Anthropic row. Adding more is an admin job, and admin comes later.

Daily, company, family, region, and custom are specified in [Rules](rules.md) and come later. The home page lists them, and only All models can be started. Size is a hint, not a category. The profile page is in this prototype. The home weekly top 5, daily result stats, and the admin screens come later. The pause flag exists from the first build, because a credit error pauses everyone.

## Stack

| Piece | Role |
|---|---|
| Next.js on Node 22 | The site, and the only code that talks to a model |
| Vercel AI SDK `ai` v7 and `@openrouter/ai-sdk-provider` | One call shape for every model. Replies stream word by word |
| Supabase Auth | Google and email/password, same user table |
| Supabase Postgres | Catalog, games, the message transcript, guesses, cost ledger |
| Supabase Storage | Later. Company logos, with a URL as the fallback |
| OpenRouter | One API key, one bill, USA / Europe / China models |
| Vercel Hobby | Hosting, HTTPS, a `*.vercel.app` URL |
| A Python notebook later | Charts the admin page does not have |

The browser never receives the OpenRouter key, the Supabase secret key, or the hidden model id of an active round. The guess list the browser receives is logo, company, and name for the models the server has already kept.

Pages and route handlers are one Next.js app. The handlers are the backend: they hold the keys, call OpenRouter, and write the game. There is no second server. A split would add another deploy and another hop on every message, for a site with one client. Supabase is the database and the login, not an application server. The Python notebook stays outside, for charts.

## Hosting

Publishing a GitHub Release deploys that tag to Vercel production. A push or a pull request does not. The workflow reads `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` from GitHub Actions secrets. The app env stays on the Vercel project. Hobby is free. A function may run for several minutes, which covers a reply. There is no machine to patch.

The game is on a `something.vercel.app` address before any domain exists. Buy a domain when the game is worth showing. In the Vercel project, Settings → Domains, add the name. At the registrar, add the records Vercel shows:

- an **A** record for the bare name (`whosthatllm.com`)
- a **CNAME** for `www`, aimed at the target Vercel gives that project

Leave the nameservers at the registrar. Vercel issues the certificate once the records propagate. A domain is about ten to fifteen francs a year. The API bill is the cost that matters.

## Accounts

No VPS, no extra email service, no second database.

| What | What to do | When |
|---|---|---|
| **GitHub** | Already exists: `glederrey/whos-that-llm`. Publishing a release deploys that tag. | Done |
| **Supabase** | One project. Copy the project URL, the publishable key, and the secret key. Turn on Email and Google under Authentication. Set the site URL and the redirect URLs to the main page, `/`. | Before auth works |
| **Google Cloud** | One project on the existing Google account. No billing. OAuth client (Web). Authorized redirect: `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the id and secret into the Supabase Google provider. | Before the Google button works |
| **OpenRouter** | Account, about $10 of credit, one API key, a monthly cap around $20. The key stays in env vars. Gael tops up credits himself. | Before the first real model call |
| **Vercel** | Sign up with GitHub. Hobby. Paste the env vars from [Build](build.md). | When the app is deployed. Local play does not need it |
| **Ko-fi** | One page for tips. Stay on the free setting, so a one-time tip pays no Ko-fi fee. Connect Stripe. Set the page currency to euros. Paste the page URL into `tipUrl`. | Before the footer shows **Tip** |
| **Domain registrar** | Buy the name and add the two DNS records. | After someone besides us is playing |

Ko-fi does not price a page in francs, so euros avoids a second conversion on a European card. Stripe pays out to the Swiss account. A tip is not an account on this site, and it buys nothing in the game. The API bill stays on the OpenRouter cap until tips actually cover it.

Supabase sends confirmation and password-reset mail. Both links return to the main page. That quota is enough to start. Custom SMTP is the fix if those emails start failing.

Admin is not a role you hand out. `/admin` and `/admin/models` render only when the server matches the signed-in Supabase email to the owner address. Everyone else gets the same 404 as a missing page. The account menu shows **Admin** only for that session. Other sessions have no link.

## Auth

Players sign up or log in before they can play. The main page is public. Every play route requires a session.

Both methods stay on, and both write into `auth.users`. Link identities that share an email, so one person does not get two accounts.

Email confirmation stays on. Confirmation and password-reset links return to `/`. The main page completes the session from that return. The first session with no username goes to `/welcome`.

A username is 3–20 characters after trimming. Capitals and punctuation are allowed. It does not have to be unique. An empty name is rejected. `profiles.id` is the internal id that links the auth user (and therefore the email) to the username. A rename updates `profiles.username` and every `games.username` for that user id, so the leaderboard and past games show the new name. The old name is not kept.

A signed-in player can delete their own account from the profile page or from **Delete account**. They confirm first. The action uses the session id and ignores any other id. It removes that player's profile, picture, games, messages, guesses, and usage, so the name leaves the leaderboard. Then it deletes the auth user, signs them out, and returns to `/`.

## Credits

OpenRouter 402, or an explicit credit error, sets `app_settings.paused` and pauses the game for everyone. Admin can also pause. Gael tops up credits on OpenRouter himself. There is no top-up inside the site. Unpause from the admin switch once that screen exists. Until then, clear the flag in the database after the credit is topped up.

## Limits the player can see

These three are on the landing page, the lobby, and the round.

| Limit | Value | On screen |
|---|---|---|
| Messages in a round | **10** | `Message 2 of 10` |
| Guesses | **optional, one per message** | `Guess for message 2`, or send the next message |
| Games | **10 per rolling hour** | `4 of 10 this hour`, plus when the next slot frees |

Also:

- A user message is at most **500 characters**. The input shows the counter.
- The assistant reply is capped at **500 output tokens**. The server clamps this. Nothing in the database can raise it.
- An empty or whitespace-only user message is rejected and does not spend a turn.
- An empty or whitespace-only successful model reply still spends the message.
- One open round per account. The lobby offers Continue.
- The daily model, when that category exists, is once per account per UTC day, and it counts toward the 10.

The hourly check and the insert run in one transaction. Two tabs cannot both take the last slot. A started round counts, including a give-up before the first message.

## What a round costs

Ten replies are 5,000 output tokens, plus the growing transcript on the way in. A thinking model can spend part of that budget before any visible words. That spend is an admin cost fact. It is not a trait the player can score or buy. October 2026 list prices, for a full round:

| Tier | Examples | About one full round |
|---|---|---|
| Small | Haiku 5.5, the Lunas, DeepSeek Flash | under 1 cent. Haiku 4.5 is a few cents |
| Medium | Sonnet 5.5, GPT-5.6 Sol | about 5 cents |
| Large | Opus 5.5 | about 10 cents, more when the model spends heavily before the visible reply |
| Leave out | Fable | several times an Opus round |

Ten Opus rounds in an hour is about a dollar for that player. The OpenRouter monthly cap is the backstop. Every call stores `cost_usd` and `reasoning_tokens`. A model whose spend stays high gets disabled from the admin page, once that page exists.
