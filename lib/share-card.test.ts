import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareActions } from "../components/share-actions";
import { ShareCardView } from "../components/share-card";
import { rulesForGameMode } from "./config";
import { scoreRound, type Traits } from "./game";
import {
  buildShareCard,
  difficultyColor,
  facebookShareUrl,
  linkedInShareUrl,
  isShareGameId,
  shareCardDisplay,
  shareFileName,
  sharePageUrl,
  shareText,
  tokensFromBreakdown,
  xShareUrl,
  type ShareCardInput,
} from "./share-card";
import { shareCardImage } from "./share-card-image";

const root = path.resolve(import.meta.dirname, "..");
const hidden = "Claude Opus 4.7";
const decoy = "GPT Secret";
const chat = "tell me a secret phrase from the transcript";

function traits(): Traits {
  return {
    given: [],
    models: {
      hidden: {
        name: hidden,
        companyId: "anthropic",
        companyName: "Anthropic",
        region: "us",
        size: "large",
        year: 2026,
        logoPath: "logos/anthropic.png",
      },
      other: {
        name: decoy,
        companyId: "openai",
        companyName: "OpenAI",
        region: "us",
        size: "small",
        year: 2026,
        logoPath: "logos/openai.png",
      },
    },
  };
}

function input(overrides: Partial<ShareCardInput> = {}): ShareCardInput {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    gameMode: "all",
    poolKey: null,
    difficulty: 3,
    status: "solved",
    messageCount: 3,
    score: 1240,
    breakdown: [{ label: "Tokens · 1,420 tokens", points: null, multiplier: "×7.042" }],
    modelId: "hidden",
    traits: traits(),
    ...overrides,
  };
}

function card(overrides: Partial<ShareCardInput> = {}) {
  const built = buildShareCard(input(overrides));
  assert.ok(built);
  return built;
}

test("a finished round becomes a score card", () => {
  const daily = card({ gameMode: "daily", difficulty: 1, status: "solved" });
  assert.equal(daily.modeLine, "Daily · Easy");
  assert.equal(daily.outcome, "Solved");
  assert.equal(daily.score, 1240);
  assert.equal(daily.messages, 3);
  assert.equal(daily.tokens, 1420);
  assert.equal(daily.modelName, null);
  assert.equal(JSON.stringify(daily).includes(hidden), false);
  assert.equal(JSON.stringify(daily).includes(decoy), false);
  assert.equal(JSON.stringify(daily).includes(chat), false);

  const hard = card({ gameMode: "all", difficulty: "hard", status: "miss", score: 400 });
  assert.equal(hard.modeLine, "All models · Hard");
  assert.equal(hard.outcome, "Not solved");
  assert.equal(hard.modelName, hidden);
  assert.equal(JSON.stringify(hard).includes(decoy), false);

  const company = card({ gameMode: "company", poolKey: "anthropic", difficulty: null });
  assert.equal(company.modeLine, "Company · Anthropic");
  assert.equal(shareCardDisplay(company).variantColor, null);

  const category = card({ gameMode: "class", poolKey: "opus", categoryName: "Opus", difficulty: null, modelId: "hidden" });
  assert.equal(category.modeLine, "Category · Opus");
  assert.equal(card({ gameMode: "class", poolKey: "opus", difficulty: null }).modeLine, "Category · opus");

  assert.equal(card({ gameMode: "region", poolKey: "us", difficulty: null }).modeLine, "Region · USA");
  assert.equal(card({ gameMode: "custom", difficulty: null }).modeLine, "Custom");
  const givenUp = card({ status: "given_up", score: null, breakdown: null, messageCount: 0 });
  assert.equal(givenUp.outcome, "Given up");
  assert.deepEqual(givenUp.details, []);
  assert.equal(givenUp.hints, null);
  assert.equal(givenUp.invite, "Come try a round");
  assert.equal(buildShareCard(input({ status: "active" })), null);
});

test("the card uses the tokens the score counted", () => {
  const scored = scoreRound({
    rules: rulesForGameMode(true),
    namedModel: true,
    regionMatched: false,
    companyMatched: false,
    regionGiven: false,
    companyGiven: false,
    tokens: 2694,
    noHint: false,
    hints: [],
    difficulty: "hard",
  });
  assert.equal(tokensFromBreakdown(scored.breakdown), 2694);
  assert.equal(tokensFromBreakdown([{ label: "Tokens · 0 tokens", points: null, multiplier: "×20" }]), 0);
  assert.equal(tokensFromBreakdown(null), null);
  assert.equal(card({ score: null, breakdown: null }).tokens, null);
});

test("difficulty words use the leaderboard colors", () => {
  assert.deepEqual(difficultyColor, {
    easy: "#1c7c43",
    medium: "#d4a017",
    hard: "#c41b15",
    impossible: "#a78bfa",
  });
  const display = shareCardDisplay(card({ gameMode: "daily", difficulty: "impossible" }));
  assert.equal(display.mode, "Daily");
  assert.equal(display.variant, "Impossible");
  assert.equal(display.variantColor, "#a78bfa");
  assert.equal(shareCardDisplay(card({ gameMode: "company", poolKey: "anthropic", difficulty: null })).variantColor, null);
});

test("share text names the round and hides a daily model", () => {
  const daily = card({ gameMode: "daily", difficulty: "easy" });
  const text = shareText(daily);
  assert.equal(text, "I scored 1,240 on Who's that LLM? Daily, Easy. Can you beat it?");
  assert.equal(text.includes(hidden), false);
  assert.equal(text.includes(chat), false);
  const named = card({ gameMode: "all", difficulty: "hard" });
  assert.equal(
    shareText(named),
    `I scored 1,240 on Who's that LLM? All models, Hard. It was ${hidden}. Can you beat it?`,
  );
  const missed = card({ gameMode: "all", difficulty: "hard", status: "miss", score: 400 });
  assert.equal(
    shareText(missed),
    `I scored 400 on Who's that LLM? All models, Hard, and missed the model. It was ${hidden}.`,
  );
  const quiet = card({ status: "given_up", score: null, breakdown: null, gameMode: "daily", difficulty: "medium" });
  assert.equal(shareText(quiet), "I gave up on Who's that LLM? Daily, Medium. Come try a round.");
  assert.equal(shareCardDisplay(quiet).score, "—");
  assert.equal(shareCardDisplay(quiet).tokens, "—");
  assert.equal(shareCardDisplay(card()).invite, "Can you beat 1,240?");
  assert.equal(shareCardDisplay(card()).site, "whos-that-llm.com");
  assert.equal(card().hints, "Hints · none");
  const hinted = card({
    breakdown: [
      { label: "Year hint", points: -100 },
      { label: "No-hint", points: null, multiplier: "×2" },
    ],
  });
  assert.equal(hinted.hints, null);
  assert.deepEqual(hinted.details, [
    { label: "Year hint", value: "-100" },
    { label: "No-hint", value: "×2" },
  ]);
  assert.equal(shareFileName(idFromCard()), `whos-that-llm-${idFromCard()}.png`);
});

function idFromCard(): string {
  return "11111111-1111-4111-8111-111111111111";
}

test("X and Facebook get the text and the link to this round", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const page = sharePageUrl(id);
  assert.equal(page, `https://www.whos-that-llm.com/r/${id}`);
  const text = "Solved · 1,240 · Daily · Easy — Who's that LLM?";
  const x = new URL(xShareUrl(page, text));
  assert.equal(`${x.origin}${x.pathname}`, "https://twitter.com/intent/tweet");
  assert.equal(x.searchParams.get("text"), text);
  assert.equal(x.searchParams.get("url"), page);
  const facebook = new URL(facebookShareUrl(page, text));
  assert.equal(`${facebook.origin}${facebook.pathname}`, "https://www.facebook.com/sharer/sharer.php");
  assert.equal(facebook.searchParams.get("u"), page);
  assert.equal(facebook.searchParams.get("quote"), text);
  const linkedIn = new URL(linkedInShareUrl(page));
  assert.equal(`${linkedIn.origin}${linkedIn.pathname}`, "https://www.linkedin.com/sharing/share-offsite/");
  assert.equal(linkedIn.searchParams.get("url"), page);
  assert.equal(isShareGameId(id), true);
  assert.equal(isShareGameId("not-a-game"), false);
});

test("the on-page card and the image leave out the chat and a daily model", () => {
  const daily = card({ gameMode: "daily", difficulty: "easy", status: "miss", score: 100 });
  const html = renderToStaticMarkup(createElement(ShareCardView, { card: daily }));
  assert.match(html, /Who&#x27;s that LLM\?/);
  assert.match(html, /Daily/);
  assert.match(html, /Easy/);
  assert.match(html, /Not solved/);
  assert.match(html, /#1c7c43/);
  assert.match(html, /Messages/);
  assert.match(html, /Tokens/);
  assert.equal(html.includes(hidden), false);
  assert.equal(html.includes(decoy), false);
  assert.equal(html.includes(chat), false);
  assert.equal(html.includes("transcript"), false);

  const image = renderToStaticMarkup(shareCardImage(daily, "data:image/png;base64,aaaa"));
  assert.equal(image.includes(hidden), false);
  assert.equal(image.includes(chat), false);
  assert.match(image, /Not solved/);
  assert.match(image, /border-radius:56px/);
  assert.match(image, /#00BBC9|rgb\(0, 187, 201\)|#00bbc9/);
  assert.match(image, />·</);
  assert.doesNotMatch(image, /· Easy/);
  assert.match(image, /Can you beat/);
  assert.match(image, /whos-that-llm\.com/);
  assert.match(image, /Hints · none/);

  const named = renderToStaticMarkup(createElement(ShareCardView, { card: card() }));
  assert.match(named, new RegExp(hidden));
  assert.equal(named.includes(decoy), false);
});

test("share comes before download, and the networks live in one menu", () => {
  const html = renderToStaticMarkup(
    createElement(ShareActions, { gameId: "11111111-1111-4111-8111-111111111111", text: "Solved" }),
  );
  assert.match(html, /class="button"[^>]*>Share<svg[\s\S]*button-quiet[^>]*>[\s\S]*Download/);
  assert.match(html, /share-phone[\s\S]*Share/);
  assert.match(html, /share-caret/);
  assert.match(html, /share-network-menu" [^>]*hidden/);
  assert.match(html, />X</);
  assert.match(html, />Facebook</);
  assert.match(html, />LinkedIn</);
  assert.match(html, />Instagram</);
  assert.equal(html.includes("Bluesky"), false);
  assert.match(html, /linkedin\.com\/sharing\/share-offsite/);
  assert.match(html, /card\.png\?download=1/);
  assert.match(html, /whos-that-llm-11111111-1111-4111-8111-111111111111\.png/);
  assert.equal(html.includes("Share on X"), false);
  assert.equal(html.includes("Share on Facebook"), false);
});

test("the public card is drawn from the game row and is not stored", () => {
  const load = fs.readFileSync(path.join(root, "lib/share-card-load.ts"), "utf8");
  const route = fs.readFileSync(path.join(root, "app/r/[gameId]/card.png/route.tsx"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/r/[gameId]/page.tsx"), "utf8");
  assert.match(load, /id, status, game_mode, pool_key, difficulty, message_count, score, score_breakdown, model_id, traits/);
  assert.doesNotMatch(load, /from\("messages"\)/);
  assert.doesNotMatch(load, /from\("usage"\)/);
  assert.doesNotMatch(load, /from\("guesses"\)/);
  assert.doesNotMatch(`${load}\n${route}\n${page}`, /\.storage|writeFile/);
  assert.doesNotMatch(page, /MessageBubble|transcript/);
});
