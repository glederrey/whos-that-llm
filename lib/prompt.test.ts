import assert from "node:assert/strict";
import { test } from "node:test";
import { roundContext, systemPrompt } from "./prompt";

test("each game mode tells the model what the human chooses from", () => {
  assert.match(roundContext({ gameMode: "all", poolSize: 138 }) ?? "", /list of 138 models/);
  assert.match(roundContext({ gameMode: "daily", poolSize: 40 }) ?? "", /list of 40 models/);
  assert.match(roundContext({ gameMode: "company", poolSize: 6, companyName: "xAI" }) ?? "", /6 models made by xAI/);
  assert.match(roundContext({ gameMode: "class", poolSize: 9, categoryName: "Open weights" }) ?? "", /category "Open weights"/);
  assert.match(roundContext({ gameMode: "custom", poolSize: 4 }) ?? "", /picked 4 models/);
  assert.match(roundContext({ gameMode: "origin", poolSize: 90 }) ?? "", /only guess which origin/);
  assert.equal(roundContext({ gameMode: "company", poolSize: 6 }), null);
  assert.equal(roundContext({ gameMode: "latest", poolSize: 6 }), null);
});

test("the context sits in the system prompt only when there is one", () => {
  const now = new Date("2026-10-11T10:00:00Z");
  assert.ok(!systemPrompt(now).includes("This round"));
  assert.ok(systemPrompt(now, "This round: x.").includes("This round: x."));
});
