# Overview

A chat game. A hidden model answers. The player has ten messages. They can name a model after a reply, or send the next message with no guess, or give up. Naming the model sets the base to 2000, and that is the maximum base. If they never name it, the base is 100 for the origin and 300 for the company, when those matched. A wrong model name subtracts 100 from the subtotal, before the multipliers. Year and size can be bought as hints. They add no points.

The name on the site is **Who's that LLM?**.

## The game

One site. A player signs up or logs in before they can play. They get ten messages, a word-by-word reply, an optional guess, hints, no-hint mode, and a result page.

The roster is the `models` table. [`supabase/seed.sql`](../supabase/seed.sql) loads a snapshot of it: about 145 models from 11 companies (Alibaba, Anthropic, DeepSeek, Google, Meta, Mistral, Moonshot, OpenAI, Perplexity, xAI, Z.ai), nearly all on. A few are seeded off, such as the Fable rows, and a few old Anthropic rows are unavailable. The seed also holds two categories (Opus and Sonnet), the OpenRouter provider slugs, and the pause flag set to `false`. The owner changes the roster in `/admin/models`.

Daily uses the same rules as All models, once per account per difficulty per UTC day. Company, Category, Origin, and Custom are specified in [Rules](rules.md) and [Game modes](game-modes.md). The home page lists a card for each, and all of them can be started. Hints are possible on Daily, All models, Company, Category, and Custom. Size is a hint, not a category. The home page shows the weekly top 5, and the profile page shows a player's history. The pause flag is set when OpenRouter answers HTTP 402, because a credit error pauses everyone.

## Stack

| Piece | Role |
|---|---|
| Next.js on Node 22 | The site, and the only code that talks to a model |
| Vercel AI SDK `ai` v7 and `@openrouter/ai-sdk-provider` | One call shape for every model. Replies stream word by word |
| Supabase Auth | Google and email/password, same user table |
| Supabase Postgres | Catalog, games, the message transcript, guesses, cost ledger |
| Supabase Storage | Company logos (`logos` bucket) and profile pictures (`avatars` bucket) |
| OpenRouter | One API key, one bill, USA / Europe / China models |
| Vercel Hobby | Hosting, HTTPS, a `*.vercel.app` URL |

The browser never receives the OpenRouter key, the Supabase secret key, or the hidden model id of an active round. The guess list the browser receives is logo, company, and name for the models the server has already kept.

Pages and route handlers are one Next.js app. The handlers are the backend: they hold the keys, call OpenRouter, and write the game. There is no second server. A split would add another deploy and another hop on every message, for a site with one client. Supabase is the database and the login, not an application server.

## Hosting

Publishing a GitHub Release deploys that tag to Vercel production. A push or a pull request does not. The workflow reads `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` from GitHub Actions secrets. The app env stays on the Vercel project. Hobby is free. A function may run for several minutes, which covers a reply. There is no machine to patch.

The game is on a `something.vercel.app` address before any domain exists. Buy a domain when the game is worth showing. In the Vercel project, Settings → Domains, add the name. At the registrar, add the records Vercel shows:

- an **A** record for the bare name (`whos-that-llm.com`)
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
| **Ko-fi** | One page for tips. Stay on the free setting, so a one-time tip pays no Ko-fi fee. Connect Stripe. Set the page currency to euros. Paste the page URL into `tipUrl`. | Before the footer shows **The API bill is winning, a little help?** |
| **Domain registrar** | Buy the name and add the two DNS records. | After someone besides us is playing |

Ko-fi does not price a page in francs, so euros avoids a second conversion on a European card. Stripe pays out to the Swiss account. A tip is not an account on this site, and it buys nothing in the game. The API bill stays on the OpenRouter cap until tips actually cover it.

Supabase sends confirmation and password-reset mail. The confirmation link returns to the main page and the reset link to `/reset-password`, which sets the new password without signing the player in. That quota is enough to start. Custom SMTP is the fix if those emails start failing.

Admin is not a role you hand out. The admin pages render only when the signed-in Supabase user has `app_metadata.admin === true`. A missing flag matches nobody. Everyone else gets the same 404 as a missing page. The account menu shows **Admin** only for that session. Other sessions have no link.

## Auth

Players sign up or log in before they can play. The main page is public. Every play route requires a session.

Both methods stay on, and both write into `auth.users`. Link identities that share an email, so one person does not get two accounts.

Email confirmation stays on. The confirmation link returns to `/` and the password-reset link to `/reset-password`. The main page completes the session from that return; the reset page never leaves one open. The first session with no username goes to `/welcome`.

A username is 3–20 characters after trimming. Capitals and punctuation are allowed. It does not have to be unique. An empty name is rejected. `profiles.id` is the internal id that links the auth user (and therefore the email) to the username. A rename updates `profiles.username` and every `games.username` for that user id, so the leaderboard and past games show the new name. The old name is not kept.

A signed-in player can delete their own account from the profile page. They confirm first. An unchecked click does not submit. The action uses the session id and ignores any other id. It clears that player's name on their games, removes the profile and picture, and leaves the rounds, messages, and guesses in place. The name leaves the leaderboard. Then it deletes the auth user, signs them out, and returns to `/`.

## Credits

An HTTP 402 from OpenRouter sets `app_settings.paused` and pauses the game for everyone. Only the status code counts, not the message text. Gael tops up credits on OpenRouter himself. There is no top-up inside the site. No admin page writes the flag, so clear it in the database after the credit is topped up.

## Limits the player can see

These three are on the landing page, the lobby, and the round.

| Limit | Value | On screen |
|---|---|---|
| Messages in a round | **10** | `Message 2 of 10` |
| Guesses | **optional, one per message** | `Guess for message 2`, or send the next message |
| Games | **20 per rolling hour** | `4 of 20 this hour`, plus when the next slot frees |

Also:

- A user message is at most **500 characters**. The input shows the counter.
- The assistant reply is capped at **2,000 output tokens**. The server clamps this. Nothing in the database can raise it.
- An empty or whitespace-only user message is rejected and does not spend a turn.
- An empty or whitespace-only successful model reply still spends the message.
- One open round per game mode and difficulty. Another difficulty can start. The unfinished row says **Game isn't finished yet. Continue?**
- Daily is once per account per difficulty per UTC day, and each of those rounds counts toward the hourly cap.

The hourly check and the insert run in one transaction. Two tabs cannot both take the last slot. A started round counts, including a give-up before the first message.

## What a round costs

Ten replies are 20,000 output tokens, plus the growing transcript on the way in. A thinking model can spend part of that budget before any visible words. That spend is an admin cost fact. It is not a trait the player can score or buy. October 2026 list prices, for a full round:

| Tier | Examples | About one full round |
|---|---|---|
| Small | Haiku 5.5, the Lunas, DeepSeek Flash | under 1 cent. Haiku 4.5 is a few cents |
| Medium | Sonnet 5.5, GPT-5.6 Sol | about 5 cents |
| Large | Opus 5.5 | about 10 cents, more when the model spends heavily before the visible reply |
| Leave out | Fable | several times an Opus round |

Ten Opus rounds in an hour is about a dollar for that player. The OpenRouter monthly cap is the backstop. Every call stores `cost_usd` and `reasoning_tokens`. A model whose spend stays high can be disabled from `/admin/models`.

## Privacy

A player's messages are sent to OpenRouter and on to the provider of the hidden model. Vercel Analytics counts page views. Google sign-in is optional: email and password works too. The profile page can delete the account.
