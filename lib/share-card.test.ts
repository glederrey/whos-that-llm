import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareActions } from "../components/share-actions";
import { rulesForGameMode } from "./config";
import { scoreRound, type Traits } from "./game";
import {
  buildShareCard,
  difficultyColor,
  facebookShareUrl,
  linkedInShareUrl,
  isShareGameId,
  dailyModelVisible,
  shareCardAlt,
  shareCardDisplay,
  shareCardTheme,
  shareFileName,
  sharePageUrl,
  shareText,
  shareTextForImage,
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
  assert.equal(daily.modelLogoPath, null);
  assert.deepEqual(daily.modelFacts, []);
  assert.equal(JSON.stringify(daily).includes(hidden), false);
  assert.equal(JSON.stringify(daily).includes(decoy), false);
  assert.equal(JSON.stringify(daily).includes(chat), false);

  const hard = card({ gameMode: "all", difficulty: "hard", status: "miss", score: 400 });
  assert.equal(hard.modeLine, "All models · Hard");
  assert.equal(hard.outcome, "Not solved");
  assert.equal(hard.modelName, hidden);
  assert.equal(hard.modelLogoPath, "logos/anthropic.png");
  assert.deepEqual(hard.modelFacts, ["Anthropic", "USA", "2026", "Large"]);
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
  assert.deepEqual(givenUp.steps, []);
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
  const link = "https://www.whos-that-llm.com/r/11111111-1111-4111-8111-111111111111";
  const daily = card({ gameMode: "daily", difficulty: "easy" });
  const text = shareText(daily);
  assert.equal(
    text,
    [
      "I just played on Who's that LLM? and scored 1,240 points.",
      "Game mode: Daily\nDifficulty: Easy.",
      "Do you think you can beat my score?",
      link,
    ].join("\n\n"),
  );
  assert.equal(text.includes(hidden), false);
  assert.equal(
    shareTextForImage(text, link),
    text.replace(link, "Play here: https://www.whos-that-llm.com"),
  );
  assert.equal(text.includes(chat), false);
  const named = card({ gameMode: "all", difficulty: "hard" });
  assert.equal(
    shareText(named),
    [
      "I just played on Who's that LLM? and scored 1,240 points.",
      "Game mode: All models\nDifficulty: Hard.",
      `The model I had to guess was ${hidden}.`,
      "Do you think you can beat my score?",
      link,
    ].join("\n\n"),
  );
  const company = card({ gameMode: "company", poolKey: "anthropic", difficulty: null });
  assert.match(shareText(company), /Game mode: Company\nCompany: Anthropic\./);
  assert.equal(shareText(company).includes("Difficulty"), false);
  const missed = card({ gameMode: "all", difficulty: "hard", status: "miss", score: 400 });
  assert.match(shareText(missed), /scored 400 points/);
  assert.match(shareText(missed), new RegExp(`The model I had to guess was ${hidden}\\.`));
  const quiet = card({ status: "given_up", score: null, breakdown: null, gameMode: "daily", difficulty: "medium" });
  assert.equal(
    shareText(quiet),
    ["I just played on Who's that LLM?", "Game mode: Daily\nDifficulty: Medium.", link].join("\n\n"),
  );
  assert.equal(shareCardDisplay(quiet).score, "—");
  assert.equal(shareCardDisplay(quiet).tokens, "—");
  assert.equal(shareCardDisplay(card()).invite, "Can you beat my score of 1,240?");
  const played = new Date("2026-10-15T18:00:00.000Z");
  const today = card({ gameMode: "daily", difficulty: "easy", dailyKey: "2026-10-15:1", now: played });
  assert.equal(today.modelName, null);
  assert.equal(dailyModelVisible("2026-10-15:1", played), false);
  const later = card({ gameMode: "daily", difficulty: "easy", dailyKey: "2026-10-14:2", now: played });
  assert.equal(later.modelName, hidden);
  assert.equal(later.modelLogoPath, "logos/anthropic.png");
  assert.equal(shareText(later).includes(`The model I had to guess was ${hidden}.`), true);
  assert.equal(dailyModelVisible("2026-10-14:2", played), true);
  assert.equal(dailyModelVisible(null, played), false);
  assert.equal(dailyModelVisible("not-a-day", played), false);
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
  const played = `Played\n\n${page}`;
  const tweet = new URL(xShareUrl(page, played));
  assert.equal(tweet.searchParams.get("text"), "Played");
  assert.equal(tweet.searchParams.get("url"), page);
  assert.equal(tweet.searchParams.get("text")?.includes("Play here"), false);
  assert.equal(tweet.searchParams.get("url")?.includes("/r/"), true);
  assert.match(shareTextForImage(played, page), /Play here: https:\/\/www\.whos-that-llm\.com$/);
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

test("a card theme is dark only when the request says dark", () => {
  assert.equal(shareCardTheme("dark"), "dark");
  assert.equal(shareCardTheme("light"), "light");
  assert.equal(shareCardTheme(null), "light");
  assert.equal(shareCardTheme("nope"), "light");
});

test("the public picture and the download are the same card", () => {
  const daily = card({ gameMode: "daily", difficulty: "easy", status: "miss", score: 100 });
  const image = renderToStaticMarkup(shareCardImage(daily, "data:image/png;base64,aaaa"));
  assert.match(image, /Who&#x27;s that LLM\?|Who's that LLM\?/);
  assert.match(image, /Daily/);
  assert.match(image, /Easy/);
  assert.match(image, /#1c7c43/);
  assert.match(image, /Miss\./);
  assert.equal(image.includes("Messages"), false);
  assert.equal(image.includes("Hints"), false);
  assert.equal(image.includes(">None<"), false);
  assert.match(image, /After/);
  assert.match(image, /Before the multiplier/);
  assert.match(image, /Total/);
  assert.equal(image.includes(hidden), false);
  assert.equal(image.includes(decoy), false);
  assert.equal(image.includes(chat), false);
  assert.equal(image.includes("transcript"), false);
  assert.equal(image.includes("Anthropic"), false);
  assert.match(image, /border-radius:56px/);
  assert.match(image, /#00BBC9|rgb\(0, 187, 201\)|#00bbc9/);
  assert.doesNotMatch(image, /· Easy/);
  assert.match(image, /Can you beat my score of/);
  assert.match(image, /https:\/\/whos-that-llm\.com/);
  assert.match(image, /#EBEBEB/);
  assert.match(image, /#007F88/i);
  assert.equal(image.includes("www.whos-that-llm.com"), false);
  const darkImage = renderToStaticMarkup(shareCardImage(daily, "data:image/png;base64,aaaa", null, "dark"));
  assert.match(darkImage, /#1E1E1E/);
  assert.match(darkImage, /#EBEBEB/);
  assert.equal(/#007F88/i.test(darkImage), false);
  assert.equal(shareCardAlt(daily).includes(hidden), false);

  const named = card();
  const namedImage = renderToStaticMarkup(shareCardImage(named, "data:image/png;base64,aaaa", "data:image/png;base64,bbbb"));
  assert.match(namedImage, new RegExp(hidden));
  assert.match(namedImage, /bbbb/);
  assert.match(namedImage, /Anthropic/);
  assert.match(namedImage, /Solved on message/);
  assert.equal(namedImage.includes(decoy), false);
  assert.match(shareCardAlt(named), new RegExp(hidden));

  const page = fs.readFileSync(path.join(root, "app/r/[gameId]/page.tsx"), "utf8");
  const picture = fs.readFileSync(path.join(root, "components/share-picture.tsx"), "utf8");
  assert.match(page, /SharePicture/);
  assert.match(page, /shareCardPath/);
  assert.match(picture, /share-picture/);
  assert.match(picture, /data-theme/);
  assert.doesNotMatch(page, /ShareCardView/);
});

test("share comes before download, and the networks live in one menu", () => {
  const html = renderToStaticMarkup(
    createElement(ShareActions, { gameId: "11111111-1111-4111-8111-111111111111", text: "Solved" }),
  );
  assert.match(html, /class="button"[^>]*>Share<svg[\s\S]*Copy link[\s\S]*Download/);
  assert.match(html, /The text will be copied\. Paste it into the post\./);
  assert.match(html, /The text will be copied\. Paste it into Instagram\./);
  assert.match(html, /share-message[\s\S]*Message/);
  assert.equal(html.includes("share-phone"), false);
  assert.match(html, /share-caret/);
  assert.match(html, /share-network-menu" [^>]*hidden/);
  assert.match(html, />X</);
  assert.match(html, />Facebook</);
  assert.match(html, />LinkedIn</);
  assert.match(html, />Instagram</);
  assert.equal(html.includes("Bluesky"), false);
  assert.match(html, /linkedin\.com\/sharing\/share-offsite/);
  assert.match(html, /card\.png\?theme=light&amp;download=1/);
  assert.match(html, /whos-that-llm-11111111-1111-4111-8111-111111111111\.png/);
  assert.equal(html.includes("Share on X"), false);
  assert.equal(html.includes("Share on Facebook"), false);
});

test("the public card is drawn from the game row and is not stored", () => {
  const load = fs.readFileSync(path.join(root, "lib/share-card-load.ts"), "utf8");
  const route = fs.readFileSync(path.join(root, "app/r/[gameId]/card.png/route.tsx"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/r/[gameId]/page.tsx"), "utf8");
  assert.match(load, /id, status, game_mode, pool_key, difficulty, message_count, score, score_breakdown, model_id, traits, daily_key/);
  assert.doesNotMatch(load, /from\("messages"\)/);
  assert.doesNotMatch(load, /from\("usage"\)/);
  assert.doesNotMatch(load, /from\("guesses"\)/);
  assert.doesNotMatch(`${load}\n${route}\n${page}`, /\.storage|writeFile/);
  assert.doesNotMatch(page, /MessageBubble|transcript/);
});
