# Spec

This folder is the source of truth for Who's that LLM. Build from it. If the code and a page here disagree, change one of them in the same pass so they match again.

These files are the design doc. Do not publish them as a page on the site. There is no `/rules` route. The only scoring text a player sees is the short explanation on the result page, specified in [Pages](pages.md).

Read in this order the first time. After that, open the page for the thing you are building.

| Doc | What it decides |
|---|---|
| [Overview](overview.md) | What the game is, the first build, the stack, the accounts, the limits, the cost |
| [Rules](rules.md) | A turn, the traits, the score, no-hint mode, categories, leaderboards |
| [Pages](pages.md) | Every screen, the states, the words on them |
| [Data](data.md) | Postgres tables, constraints, access, the queries |
| [Server](server.md) | Routes, the JSON the client receives, the model call, errors |
| [Admin](admin.md) | Later. Gael edits the game without opening the database |
| [Build](build.md) | Repo layout, env, first roster, the order to build in |

**All models** is the first build. The other categories are specified so the schema and the copy have a place to land. Do not build them in the first pass.

Numbers (points, the token scale, the hint price, the no-hint multiplier) live in `lib/config.ts`, described in [Build](build.md). A round copies them onto `games.rules` when it starts, and freezes the traits it will use. Editing the file or a model row does not rewrite a game already in progress.
