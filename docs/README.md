# Spec

This folder is the source of truth for Who's that LLM. Build from it. If the code and a page here disagree, change one of them in the same pass so they match again.

Read in this order the first time. After that, open the page for the thing you are building.

| Doc | What it decides |
|---|---|
| [Overview](overview.md) | What the game is, the stack, the accounts, the limits, the cost |
| [Rules](rules.md) | A turn, the seven characteristics, scoring, categories, blind mode |
| [Pages](pages.md) | Every screen, the states, the words on them |
| [Data](data.md) | Postgres tables, constraints, access, the queries |
| [Server](server.md) | Routes, the JSON the client receives, the model call, errors |
| [Admin](admin.md) | Your account only. Home for the picture, then models, categories, stats, rounds |
| [Build](build.md) | Repo layout, env, first roster, the order to build in |

Numbers (points, caps, multipliers) live in `lib/config.ts`, described in [Build](build.md). A round copies them onto `games.rules` when it starts, so editing the file does not rewrite a game already in progress.
