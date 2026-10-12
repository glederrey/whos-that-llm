import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HistoryDetail } from "../components/history-list";
import { ResultSummary } from "../components/round-facts";
import { playedRoundFacts } from "./round-facts";

const item = {
  id: "game-1",
  when: "12 Oct 2026, 07:00 UTC",
  status: "Solved",
  state: "solved" as const,
  score: "1,200",
  best: false,
  messages: 3,
  tokens: "800",
  modelName: "Claude Haiku",
  companyName: "Anthropic",
  logoPath: null,
  companyFound: true,
  regionFound: false,
  mode: "All models",
  difficulty: "Hard",
};

test("a stored category and difficulty become the labels a player sees", () => {
  assert.deepEqual(
    playedRoundFacts({ categoryId: "all", categoryName: "All models", difficulty: 3 }),
    { mode: "All models", difficulty: "Hard" },
  );
  assert.deepEqual(
    playedRoundFacts({ categoryId: "daily", categoryName: "  Daily  ", difficulty: "easy" }),
    { mode: "Daily", difficulty: "Easy" },
  );
  assert.deepEqual(
    playedRoundFacts({ categoryId: "company", categoryName: " ", difficulty: null }),
    { mode: "company", difficulty: "—" },
  );
  assert.equal(playedRoundFacts({ categoryId: "custom", categoryName: null, difficulty: 9 }).difficulty, "—");
});

test("the history dropdown names the mode and the difficulty", () => {
  const html = renderToStaticMarkup(createElement(HistoryDetail, { item }));
  const modeAt = html.indexOf("Game mode");
  const difficultyAt = html.indexOf("Difficulty");
  assert.ok(modeAt > 0);
  assert.ok(difficultyAt > modeAt);
  assert.ok(html.includes("All models"));
  assert.ok(html.includes("Hard"));
  assert.equal(html.includes("Continue"), false);
});

test("the results summary names the same mode and difficulty", () => {
  const facts = playedRoundFacts({ categoryId: "all", categoryName: "All models", difficulty: 4 });
  const html = renderToStaticMarkup(createElement(ResultSummary, facts));
  assert.equal(html.includes("Game mode") && html.includes("All models"), true);
  assert.equal(html.includes("Difficulty") && html.includes("Impossible"), true);
  const missing = playedRoundFacts({ categoryId: "custom", categoryName: null, difficulty: null });
  const blank = renderToStaticMarkup(createElement(ResultSummary, missing));
  assert.ok(blank.includes("custom"));
  assert.ok(blank.includes("—"));
});

test("an open round still names the mode and the difficulty", () => {
  const html = renderToStaticMarkup(
    createElement(HistoryDetail, { item: { ...item, state: "active", modelName: null, difficulty: "—" } }),
  );
  assert.ok(html.includes("Game mode"));
  assert.ok(html.includes("All models"));
  assert.ok(html.includes("Difficulty"));
  assert.ok(html.includes("—"));
  assert.ok(html.includes("Continue"));
  assert.ok(html.includes("Hidden until the round ends."));
});
