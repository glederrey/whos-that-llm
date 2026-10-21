# Who's that LLM?

Guessing game. A hidden model answers for ten messages. The player names it. Site: https://www.whos-that-llm.com. The name uses a keyboard apostrophe, Who's. In HTML titles, Open Graph, and Twitter cards the source must contain the character `'`, not the text `&#x27;`. Google decodes the entity, but some search cards print the code if that is what the title contains.

Gael Lederrey runs the site and reviews in the browser. He often asks for an opinion before a change, then says to implement the option he picks. Apply a migration on the live database only when he asks.

## Game modes

Lobby and leaderboard order: Daily, All models, Company, Category, Region, Custom. Company sits above Category.

Daily, All models, and Company are open. Category, Region, and Custom are still Coming soon.

Company: the player picks one company. The list shows the logo, the name, and how many models are turned on. A turned-off model never counts. The leaderboard replaces the difficulty menu with companies. The default is All companies. The chip on a row shows the company. Hints are the year and the size only, 100 points each, because the company and its region are already known. A round can also be played with no hints. There is no difficulty multiplier. A round already open keeps the rules it started with. One unfinished Company round per account and company.

Category, when built: categories are created by hand and stored in the database. Do not automatically create All US models, All Chinese models, or All European models. A category has a logo instead of a company. The logo is an emoji, the Who's that LLM logo, or a company logo already in the database. A category can be turned on or off from the admin page. A turned-off category stays stored and is left out of the lobby and the leaderboard. A turned-off model does not count. The leaderboard default is All categories, and the chip stays on the right until one category is chosen. That applies on the main page and the leaderboard page.

Region, when built: one random model from the whole roster. Ten messages. One guess: US, Chinese, or European. The lobby copy should say that plainly. No leaderboard, no hints, no difficulties. The result is not shareable and has no score. The card shows the model and says whether the guess was right.

Custom, when built: the player searches and selects the models in the pool, then can play with hints or without. No leaderboard. The result can be shared. The card says Custom, and where a difficulty would be it says how many models were in the pool.

## Scoring and tokens

The token multiplier is `min(20, 10000 / scored tokens)`. It is 20× at 500 tokens or fewer, and 1× at 10,000 tokens. The scoring page must match.

Input tokens: the first turn is the prompt tokens, system prompt included once. Later turns are `prompt_tokens - previous prompt_tokens - previous visible output`. Visible output is completion tokens minus reasoning tokens. Reasoning tokens and cache-read tokens are not added, and cache-read is not subtracted. The database still stores the full prompt-token history. Finished games keep the score they already have.

A wrong model guess removes that company only. A wrong region removes every model in that region. A guess never sets the year or the size. Those apply only when every remaining model shares them, or when that hint was bought. Easy does not change this filter. A wrong Gemini guess drops an OpenAI model only when the region is wrong, and then every US model goes.

Games today counts games whose `finished_at` is on the current UTC day. Today's Daily is hidden from the detailed statistics, so the daily model is not given away. The summary cards and Games over time still include today.

## Sharing

`/r/{id}` is a public page: the score, who played, the UTC day, and a link home that says Try to beat this score. A round with no score says Try a round. No chat and no share buttons. Today's Daily hides the model there and says it will be revealed tomorrow. The player's own result and the profile still show the model the same day.

Download saves the card picture. On a phone the button says Download. On a wide screen it says Download card. Solved uses the Easy green chip. Failed uses the Hard red chip. Given up is gray. The downloadable card uses those same chips.

Share on a computer is X, LinkedIn, then Facebook. The post keeps the round link so the preview can be the card. Facebook and LinkedIn copy the message, and the tooltip says to paste it. On a phone, Share also offers By message and Copy link. By message opens the system sheet. Copy link stays quiet on a phone. If By message fails, a red line under the buttons says Try again. A website cannot upload the card image into a tweet.

## Models and providers

A provider that serves a reply is stored, in normal games and in the admin chat. A new row is not blacklisted. The reasoning check runs on those same paths. A reasoning model that reports 0 reasoning tokens is checked against gpt-tokenizer. If the reported output is more than 20% and more than 16 tokens higher, that provider is blacklisted and later calls skip it. A model that is not a reasoning model skips that test. A later reply does not clear a blacklist.

A model OpenRouter no longer lists stays in the database, is turned off, and cannot be turned on. Update prices and Check availability skip those rows. Category and company counts ignore models that are turned off.

An empty or whitespace model reply shows Empty message in a readable gray.

## Database

A fresh database starts from `supabase/v0.4.sql`. That file includes the migrations through `0037_company_hints.sql`. A database created from `v0.3.sql` still needs `0033` through `0037`, in filename order. Do not run `v0.4.sql` on a database that already ran those migrations.

Live, as of 18 October 2026: `0033` allows one unfinished round per account, mode, and difficulty. `0035` turns Company on. `0036` adds the unavailable-model flag. `0037` turns on Company year and size hints.

From 30 October 2026, a new table in `public` does not get Data API access by itself. The migration that creates it must grant access, or supabase-js returns permission denied. Existing tables keep their grants. A fresh reset and a preview branch need the grants too. Match the grants already used. Do not give anon, authenticated, or service_role more access than they have today.

## Play screen

The guess box stays on screen. After a guess, it says You already guessed for this message, and the player can still search the list. Submit stays off until the next reply. On the tenth reply it says It's your last guess! The header counts the next message, so two replies already sent means Message 3 of 10. Only the latest guess says what it missed. A no-hint round never shows that line. Each previous guess has a gray Message N on the right. If the list is too tall, the model rows shrink. The title Previous guesses stays full size.

On a phone, the mode sits under the message count. Give up lines up with that count. The message marks run the full width of the card.

An unfinished game is marked on its own difficulty: Game isn't finished yet. Continue? Another difficulty can start. A second game on a difficulty that already has an open round is refused. Daily follows the same rule.

A missing refresh token is a saved login the server no longer has. The page still loads, the player is signed out, and the old cookie is cleared.

## Homepage

On a phone, the three steps sit in one card, How a round works. Models in play and Companies are one row, then Games today and Players. Desktop keeps three cards and does not add Companies. Play fills the phone row. Sign up and Sign in share that width. On a wide screen those buttons are taller and the main one says Start playing. The intro names ChatGPT, Claude, and Gemini, and the model count comes from the roster. The phone headline is Guess the AI model.

Profile history, on a phone: the result sits on the right of the date. Under that, the mode and the difficulty sit on the left, and the score sits on the right. A best score is teal text with tabular digits. On a wide screen, Solved, Failed, and Given up share one line, and the score stays on the right. Failed on the profile uses the darker red. Given up is gray.
