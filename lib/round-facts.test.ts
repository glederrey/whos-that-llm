import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HistoryDetail, HistoryList } from "../components/history-list";
import { ResultSummary } from "../components/round-facts";
import { difficultyText, playedRoundFacts } from "./round-facts";

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
  difficulty: "hard" as const,
  noHint: false,
};

test("a stored category and difficulty become the labels a player sees", () => {
  assert.deepEqual(
    playedRoundFacts({ categoryId: "all", categoryName: "All models", difficulty: 3 }),
    { mode: "All models", difficulty: "hard" },
  );
  assert.deepEqual(
    playedRoundFacts({ categoryId: "daily", categoryName: "  Daily  ", difficulty: "easy" }),
    { mode: "Daily", difficulty: "easy" },
  );
  assert.deepEqual(
    playedRoundFacts({ categoryId: "company", categoryName: " ", difficulty: null }),
    { mode: "company", difficulty: null },
  );
  assert.equal(playedRoundFacts({ categoryId: "custom", categoryName: null, difficulty: 9 }).difficulty, null);
  assert.equal(difficultyText("hard"), "Hard");
  assert.equal(difficultyText(null), "—");
});

test("the history row shows the mode, the difficulty chip, and a no-hints chip", () => {
  const plain = renderToStaticMarkup(createElement(HistoryList, { items: [item] }));
  assert.ok(plain.includes("board-chip history-mode"));
  assert.ok(plain.includes("All models"));
  assert.ok(plain.includes("board-chip difficulty-hard"));
  assert.ok(plain.includes(">Hard<"));
  assert.equal(plain.includes("No hints"), false);
  assert.equal(plain.includes("history-detail"), false);

  const quiet = renderToStaticMarkup(
    createElement(HistoryList, { items: [{ ...item, difficulty: null, noHint: true }] }),
  );
  assert.ok(quiet.includes("All models"));
  assert.equal(quiet.includes("board-chip difficulty-"), false);
  assert.ok(quiet.includes("board-chip no-hints"));
  assert.ok(quiet.includes("No hints"));
});

test("the history dropdown names the mode and the difficulty", () => {
  const html = renderToStaticMarkup(createElement(HistoryDetail, { item }));
  const modeAt = html.indexOf("Game mode");
  const difficultyAt = html.indexOf("Difficulty");
  assert.ok(modeAt > 0);
  assert.ok(difficultyAt > modeAt);
  assert.ok(html.includes("All models"));
  assert.ok(html.includes("Hard"));
  assert.equal(html.includes("No hints"), false);
  assert.equal(html.includes("Continue"), false);
  const quiet = renderToStaticMarkup(createElement(HistoryDetail, { item: { ...item, noHint: true } }));
  assert.ok(quiet.includes("No hints"));
});

test("the results summary names the same mode and difficulty", () => {
  const facts = playedRoundFacts({ categoryId: "all", categoryName: "All models", difficulty: 4 });
  const html = renderToStaticMarkup(
    createElement(ResultSummary, { mode: facts.mode, difficulty: difficultyText(facts.difficulty), noHint: true }),
  );
  assert.equal(html.includes("Game mode") && html.includes("All models"), true);
  assert.equal(html.includes("Difficulty") && html.includes("Impossible"), true);
  assert.ok(html.includes("No hints"));
  const missing = playedRoundFacts({ categoryId: "custom", categoryName: null, difficulty: null });
  const blank = renderToStaticMarkup(
    createElement(ResultSummary, { mode: missing.mode, difficulty: difficultyText(missing.difficulty) }),
  );
  assert.ok(blank.includes("custom"));
  assert.ok(blank.includes("—"));
  assert.equal(blank.includes("No hints"), false);
});

test("an open round still names the mode and the difficulty", () => {
  const html = renderToStaticMarkup(
    createElement(HistoryDetail, { item: { ...item, state: "active", modelName: null, difficulty: null } }),
  );
  assert.ok(html.includes("Game mode"));
  assert.ok(html.includes("All models"));
  assert.ok(html.includes("Difficulty"));
  assert.ok(html.includes("—"));
  assert.ok(html.includes("Continue"));
  assert.ok(html.includes("Hidden until the round ends."));
});
