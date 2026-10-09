# Rules

Scoring numbers live in `lib/config.ts` and are copied onto the game when it starts. This page is the meaning of those numbers.

## A turn

```mermaid
stateDiagram-v2
  [*] --> AwaitReply: round starts, model already drawn
  AwaitReply --> AwaitGuess: reply stored
  AwaitGuess --> AwaitReply: guess or skip, and a message remains
  AwaitGuess --> Solved: exact model
  AwaitGuess --> Finished: fifth guess or skip, model not named
  AwaitReply --> GivenUp: give up
  AwaitGuess --> GivenUp: give up
  Solved --> Result
  Finished --> Result
  GivenUp --> Result
```

1. The player sends a message. The header reads `Message 1 of 5`.
2. The server calls the hidden model. The guess opens only after the reply is stored. A failed call does not spend the message.
3. The player submits one guess, or skips. A second guess on that message is rejected. A skip spends the slot and writes no guess row.
4. The server compares characteristics, pays new matches once, and returns the chip board. The model id is not in that response.
5. The player may reveal a missed characteristic. That costs points and does not call the model.
6. Naming the exact model ends the round as `solved`. After the fifth guess or skip, if the model was never named, the round ends as `finished` and the partial points stay. Give up ends as `given_up` and keeps the points already banked. Give up asks for confirmation.

The next message stays disabled while a guess is open. Refresh restores the same state from the server.

Reveals are allowed only while the round is `active`, and only after the first reply. A reveal before any conversation would identify the model without playing.

Guesses and reveals do not call OpenRouter.

## Characteristics

These seven are the whole model, for the purpose of the game. Two models match a row when the stored values are equal.

| Key | Stored as | Match | Chip when it matches | Chip when it misses |
|---|---|---|---|---|
| `company` | `models.company_id` | Same company | Company name | Wrong company |
| `family` | `models.family_id` | Same family | Family name | Wrong family |
| `region` | `companies.region` | Same `us` / `eu` / `cn` | American, European, or Chinese | Wrong region |
| `size` | `models.size` | Same `small` / `medium` / `large` | Small, medium, or large | Wrong size |
| `weights` | `models.open_weights` | Both open or both closed | Open-weight or closed | Wrong |
| `year` | calendar year of `released_on` | Same year | The year | Newer than your guess, or older |
| `reasoning` | `models.reasoning` | Both thinking, or both not | Thinking, or not a thinking model | Wrong |

Year direction uses the full date, and only when the calendar years differ. Same year is a match, including March against November. The direction text does not include the year. It appears after submit. Moving through the search list does not compare anything.

Display labels:

| Stored | Shown |
|---|---|
| `us` / `eu` / `cn` | American / European / Chinese |
| `small` / `medium` / `large` | Small / Medium / Large |
| `open_weights` true / false | Open-weight / Closed |
| `reasoning` true / false | Thinking model / Not a thinking model |

### Given chips

A characteristic every model in the pool shares is given. It is filled in when the round starts, it pays nothing, and it has no reveal button.

Compute it from the pool, not from a hardcoded list per category:

```
pool = enabled models matching the category and pool_key
for each characteristic except the origin exception:
  if the pool has exactly one distinct value:
    that characteristic is given, and the value is that one
```

Consequences, so we do not special-case them in the UI:

- Company mode gives company. Region is given too, because a company has one region.
- A family that belongs to one company gives family, company, and region. Size is given when that family has one size.
- Region mode gives region. Size mode gives size.
- All-models mode gives nothing, unless the whole roster happens to share a value. Do not enable a roster that is all American and then act surprised that region is given.

Origin exception: `region` is never given and never revealable. It is the answer. The other six still follow the rule above.

### Known values

A value becomes known when it is given, revealed, or matched by a guess. The search list and the guess check use known values only.

Year direction is not a known value. "Older than your guess" does not filter the catalog. Filtering on it would binary-search the year for free. The year filters the list only after a match or a reveal.

The server refuses a guess that contradicts a known value (`409`, key named in the body). The client also hides those rows. Hiding is convenience. The refusal is the rule.

Match points pay once per characteristic per round, the first time a guess hits them. Later guesses still record the booleans. Revealing never pays match points, and guessing a revealed characteristic later still pays nothing.

If one model is left in the list, the player still has to submit it. The round does not solve itself.

## Reveals

A missed chip is a button. Clicking it shows the true value, subtracts the cost, appends the key to `games.revealed`, and narrows the list. Each key can be revealed once.

The result page shows every characteristic. That is the end of the round, not a reveal, and it costs nothing.

## Play without hints

The lobby checkbox **Play without hints** is stored as `games.blind` and cannot change mid-round.

Blind removes the reveal buttons. The server rejects a reveal. Guess feedback stays: correct, wrong, and year direction. The raw score is multiplied by **1.25** because the missing values could not be bought.

## Scoring

A round that never names the model still has a score. The exact model is a jackpot on top of the characteristics. The stored score is `max(0, raw)`. The breakdown shows the raw lines, including a negative raw.

```
raw = category_multiplier * jackpot     # jackpot is 0 if the model was never named
    + sum(match points the player guessed, ignoring given characteristics)
    - sum(reveal costs)
raw = raw * 1.25                         # only when blind

score = max(0, raw)
```

The jackpot depends on the message number of the solving guess.

```
jackpot = 800 - 100 * (message_number - 1)
```

Message 1 pays 800. Message 5 pays 400. Then the category multiplier.

| Characteristic | Guessed | Given by the pool | Reveal cost |
|---|---|---|---|
| Company | 200 | 0 | 250 |
| Family | 150 | 0 | 180 |
| Release year | 100 | 0 | 120 |
| Size | 80 | 0 | 100 |
| Region | 60 | 0 | 80 |
| Weights | 50 | 0 | 70 |
| Reasoning | 40 | 0 | 50 |

Reveal costs more than the match, so buying the answer is a worse deal than guessing it. The player buys a chip to shrink the list.

| Category | Jackpot multiplier |
|---|---|
| All models | 1.00 |
| Daily | 1.00 |
| Latest | 0.90 |
| Family | 0.85 |
| Region | 0.80 |
| Size | 0.70 |
| Company | 0.60 |
| Origin | 0.30 |

The multiplier applies to the jackpot only. A company point is worth 200 in every mode, and 0 when the pool already gave the company away.

While a scored round is active, the header shows the banked score (matches so far, minus reveals, times 1.25 if blind) and the jackpot if they name the model on the open message. Nothing is written to `games.score` until the round ends. The banked number is recomputed from `games.rules`, the guess rows, and `revealed`, so it cannot drift from a second counter.

Custom rounds skip this section. `score` and `score_breakdown` stay null. Reveals still open the true value, and they cost nothing. Blind still hides the reveal buttons. There is no 1.25 multiplier, because there is no score to multiply.

### Worked example

All models, not blind. The truth is Claude Sonnet 5.5: Anthropic, Sonnet, US, medium, closed, 2026, thinking.

Message 1, the player names a different US closed thinking model from another year.

- Region +60, weights +50, reasoning +40
- Year chip says newer or older, and pays nothing
- Company, family, and size stay wrong

They reveal family (−180). The list becomes that family. Message 2, they name Claude Sonnet 5.5.

- Jackpot `800 - 100 = 700`
- Family +150, company +200, size +80, year +100
- Region, weights, and reasoning already paid

`700 + 60 + 50 + 40 - 180 + 150 + 200 + 80 + 100 = 1200`

The same solve on message 5 pays a 400 jackpot instead of 700. A round that finds company and family and never the model scores `200 + 150`, plus whatever else matched, minus reveals.

## Categories

The call is the same in every category: 5 messages, 500 characters, 500 output tokens, one system prompt, that model's low reasoning settings. A category only changes the pool and therefore which chips are given. Which cards exist is a table, `categories`, edited in admin. The built-ins below are seeded. A pool you create there is one more row: a fixed set of models, a multiplier, and a scored flag.

| Category | Pool | Notes |
|---|---|---|
| `all` | Every enabled model | Main mode. Built-in |
| `company` | One company, at least 2 enabled models | Company and region come out given. Built-in |
| `family` | One enabled family, at least 2 enabled models | Often the hardest. Built-in |
| `region` | `us`, `eu`, or `cn`, at least 2 enabled models | Region is given. Built-in |
| `size` | `small`, `medium`, or `large`, at least 2 | Size is given. Built-in |
| `latest` | `is_latest` models, or one company's latest when it has at least 2 | Built-in |
| `daily` | One model, same for every player that UTC day | Once per account. Built-in |
| `origin` | Every enabled model | The guess is the region. Built-in |
| `custom` | The models the player checked, at least 2 | Not scored. Built-in |
| `pool` | Members of a category you created, that are enabled | At least 2 or the card stays off |

### Custom

The player searches the enabled roster and checks the models in the round. Two is the minimum. There is no maximum other than the roster itself. The draw is uniform among the ones they checked, and that list is what they guess from.

The set is saved on the round as `pool_model_ids`. Given chips are computed from that set only. Two Opus models give company, family, region, and usually size. A mixed set gives nothing.

The round still has five messages, one guess each, reveals, and blind mode. It still counts toward the 10 games an hour, because the model call costs the same. Guesses are still stored, so the admin confusion table can include them.

It does not write a score, and it does not appear on a leaderboard.

Regions on companies:

- **us:** OpenAI, Anthropic, Google, Meta, xAI, Amazon
- **eu:** Mistral, plus any other lab we actually have a key for
- **cn:** DeepSeek, Qwen, Kimi, GLM, MiniMax, and the other Chinese labs on OpenRouter

Size, also manual:

- **small:** the cheap fast tier
- **medium:** the workhorse
- **large:** the flagship, and only the large models we are willing to pay for

`is_latest` is a manual flag, usually one to three models per company.

The daily model is `hash(utc date) mod enabled_count`, computed when the first player of the day starts, then stored so later players get the same id. Do not publish it ahead of time. The result page may say how many players solved it once that day has finished rounds.

A pool with fewer than 2 enabled models is not listed, except daily and origin, which draw from the whole enabled roster. Europe will be thin. A row with fewer than 4 models still appears, and it shows the count. A category with `enabled = false` is not listed at all.

Two models side by side, and a blind ranking vote, wait. Both are different games.
