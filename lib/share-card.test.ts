import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareActions } from "../components/share-actions";
import { SharedResult } from "../components/shared-result";
import { rulesForGameMode } from "./config";
import { scoreRound, type Traits } from "./game";
import {
  buildShareCard,
  clipText,
  difficultyColor,
  facebookShareUrl,
  linkedInShareUrl,
  isShareGameId,
  dailyModelVisible,
  shareCardAlt,
  scoreLabel,
  shareCardDisplay,
  shareBrand,
  shareCardTheme,
  shareFileName,
  sharePageUrl,
  shareGameTitle,
  sharePlayedLine,
  sharePlayedOn,
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
        origin: "us",
        size: "large",
        year: 2026,
        logoPath: "logos/anthropic.png",
      },
      other: {
        name: decoy,
        companyId: "openai",
        companyName: "OpenAI",
        origin: "us",
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

  assert.equal(card({ gameMode: "origin", poolKey: null, difficulty: null }).modeLine, "Origin");
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
    originMatched: false,
    companyMatched: false,
    originGiven: false,
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

test("a category round names the category in the meta, and a long name is clipped for the image", () => {
  const meta = shareCardDisplay(card({ gameMode: "class", poolKey: "opus", categoryName: "Opus", difficulty: null })).meta;
  assert.deepEqual(
    meta.map((row) => [row.label, row.value, row.color]),
    [
      ["Game mode", "Category", null],
      ["Category", "Opus", null],
    ],
  );
  const bare = shareCardDisplay(card({ gameMode: "class", poolKey: "", categoryName: null, difficulty: null }));
  assert.deepEqual(bare.meta.map((row) => row.label), ["Game mode"]);
  assert.equal(clipText("Opus", 26), "Opus");
  const long = "A".repeat(40);
  assert.equal(clipText(long, 26), `${"A".repeat(26)}…`);
  assert.equal(Array.from(clipText(long, 26)).length, 27);
});

test("a Custom card names the mode and the number of models, with no difficulty", () => {
  const custom = shareCardDisplay(card({ gameMode: "custom", difficulty: null, poolKey: null, poolModelIds: ["a", "b"] }));
  assert.deepEqual(
    custom.meta.map((row) => [row.label, row.value]),
    [
      ["Game mode", "Custom"],
      ["Pool", "2 models"],
    ],
  );
});

test("the pool size comes from the stored snapshot and is the last meta row", () => {
  const sized = shareCardDisplay(card({ poolModelIds: ["a", "b", "c"] }));
  assert.equal(card({ poolModelIds: ["a", "b", "c"] }).poolSize, 3);
  assert.deepEqual(
    sized.meta.map((row) => [row.label, row.value]),
    [
      ["Game mode", "All models"],
      ["Difficulty", "Hard"],
      ["Pool", "3 models"],
    ],
  );
  for (const missing of [undefined, null, [], "x"]) {
    const bare = card({ poolModelIds: missing });
    assert.equal(bare.poolSize, null);
    assert.equal(shareCardDisplay(bare).meta.some((row) => row.label === "Pool"), false);
  }
});

test("share text names the round and hides a daily model", () => {
  const link = "https://www.whos-that-llm.com/r/11111111-1111-4111-8111-111111111111";
  const daily = card({ gameMode: "daily", difficulty: "easy" });
  const text = shareText(daily);
  assert.equal(
    text,
    [
      `I just played on ${shareBrand} and scored 1,240 points.`,
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
      `I just played on ${shareBrand} and scored 1,240 points.`,
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
    [`I just played on ${shareBrand}`, "Game mode: Daily\nDifficulty: Medium.", link].join("\n\n"),
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
  const text = `Solved · 1,240 · Daily · Easy — ${shareBrand}`;
  const x = new URL(xShareUrl(page, text));
  assert.equal(`${x.origin}${x.pathname}`, "https://twitter.com/intent/tweet");
  assert.equal(x.searchParams.get("text"), `${text}\n\n`);
  assert.equal(x.searchParams.get("url"), page);
  const played = `Played\n\n${page}`;
  const tweet = new URL(xShareUrl(page, played));
  assert.equal(tweet.searchParams.get("text"), "Played\n\n");
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
  assert.equal(shareCardDisplay(daily).title, "Who's that LLM?");
  assert.equal(shareCardDisplay(daily).title.includes("\u2019"), false);
  assert.equal(shareCardDisplay(daily).title.includes("&#"), false);
  assert.match(image, /Who&#x27;s that LLM\?/);
  assert.equal(image.includes("&amp;#x27;"), false);
  assert.equal(image.includes("\u2019"), false);
  assert.match(image, /Daily/);
  assert.match(image, /Easy/);
  assert.match(image, /#1c7c43/);
  assert.match(image, /Failed/);
  assert.match(image, /background:#c41b15/);
  assert.match(image, /color:#fff/);
  assert.doesNotMatch(image, /#FDECEC|#fdecec|#E6F8F8|#e6f8f8/);
  assert.equal(image.includes("Messages"), false);
  assert.equal(image.includes("Hints"), false);
  assert.equal(image.includes(">None<"), false);
  assert.match(image, /After/);
  assert.match(image, /Before the multiplier/);
  assert.match(image, /Total/);
  assert.match(image, /Model hidden/);
  assert.match(image, /It will be revealed tomorrow/);
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
  assert.match(darkImage, /background:#c41b15/);
  assert.match(darkImage, /color:#fff/);
  assert.equal(/#007F88/i.test(darkImage), false);
  assert.equal(shareCardAlt(daily).includes(hidden), false);

  const named = card();
  const namedImage = renderToStaticMarkup(shareCardImage(named, "data:image/png;base64,aaaa", "data:image/png;base64,bbbb"));
  assert.match(namedImage, new RegExp(hidden));
  assert.match(namedImage, /bbbb/);
  assert.match(namedImage, /Anthropic/);
  assert.match(namedImage, /Solved on message/);
  assert.match(namedImage, /background:#1c7c43/);
  assert.match(namedImage, /color:#fff/);
  assert.equal(namedImage.includes("Model hidden"), false);
  assert.equal(namedImage.includes(decoy), false);
  assert.match(shareCardAlt(named), new RegExp(hidden));
  const quiet = card({ status: "given_up", score: null, breakdown: null, messageCount: 0 });
  const quietImage = renderToStaticMarkup(shareCardImage(quiet, "data:image/png;base64,aaaa"));
  assert.match(quietImage, /Given up/);
  assert.match(quietImage, /background:#F3F3F4/i);
  assert.match(quietImage, /color:#141414/i);
  assert.match(quietImage, /border:1px solid #D4D4D8/i);
  assert.doesNotMatch(quietImage, /background:#1c7c43|background:#c41b15/);
  const quietDark = renderToStaticMarkup(shareCardImage(quiet, "data:image/png;base64,aaaa", null, "dark"));
  assert.match(quietDark, /background:#383838/i);
  assert.match(quietDark, /color:#EBEBEB/i);
  assert.match(quietDark, /border:1px solid #4A4A4A/i);

  const page = fs.readFileSync(path.join(root, "app/r/[gameId]/page.tsx"), "utf8");
  assert.match(page, /shareCardPath/);
  assert.doesNotMatch(page, /SharePicture|ShareCardView/);
});

test("the public result is the score table and a link home", () => {
  const named = card({ playerName: "Gael" });
  const html = renderToStaticMarkup(createElement(SharedResult, { card: named }));
  assert.match(html, />Gael&#x27;s score</);
  assert.equal(html.includes("Your score"), false);
  assert.equal(html.includes("hidden until the next day"), false);
  assert.match(html, /1,240/);
  assert.match(html, /Solved on message/);
  assert.match(html, /All models/);
  assert.match(html, /Hard/);
  assert.match(html, new RegExp(hidden));
  assert.match(html, /Try to beat this score/);
  assert.match(html, /href="\/"/);
  assert.equal(html.includes("How scoring works"), false);
  assert.equal(html.includes("transcript"), false);
  assert.equal(html.includes(chat), false);
  assert.equal(html.includes(decoy), false);
  assert.equal(html.includes("Share"), false);
  assert.equal(html.includes("Download"), false);

  const daily = card({ gameMode: "daily", difficulty: "easy" });
  const dailyHtml = renderToStaticMarkup(createElement(SharedResult, { card: daily }));
  assert.equal(dailyHtml.includes(hidden), false);
  assert.match(dailyHtml, /Model hidden/);
  assert.match(dailyHtml, /It will be revealed tomorrow/);
  assert.match(dailyHtml, /logo-tail-right/);
  assert.match(dailyHtml, /Daily/);
  assert.match(dailyHtml, /Easy/);
  assert.match(dailyHtml, /#1c7c43/);
  const when = new Date("2026-10-16T12:00:00.000Z");
  const today = card({
    gameMode: "daily",
    difficulty: "easy",
    dailyKey: "2026-10-16:1",
    now: when,
    playerName: "Gael",
    finishedAt: "2026-10-16T18:30:00.000Z",
  });
  assert.equal(today.modelHidden, true);
  assert.equal(today.modelName, null);
  assert.equal(today.playerName, "Gael");
  assert.equal(today.playedOn, "October 16, 2026");
  const todayHtml = renderToStaticMarkup(createElement(SharedResult, { card: today }));
  assert.equal(todayHtml.includes(hidden), false);
  assert.match(todayHtml, /Gael&#x27;s game|Gael's game/);
  assert.match(todayHtml, /Played on October 16, 2026\./);
  assert.match(todayHtml, /Model hidden/);
  assert.match(todayHtml, /It will be revealed tomorrow/);
  const yesterday = card({
    gameMode: "daily",
    difficulty: "easy",
    dailyKey: "2026-10-15:1",
    now: when,
    playerName: "Gael",
    finishedAt: "2026-10-15T18:30:00.000Z",
  });
  assert.equal(yesterday.modelHidden, false);
  assert.equal(yesterday.modelName, hidden);
  const yesterdayHtml = renderToStaticMarkup(createElement(SharedResult, { card: yesterday }));
  assert.match(yesterdayHtml, new RegExp(hidden));
  assert.equal(yesterdayHtml.includes("Model hidden"), false);
  assert.match(yesterdayHtml, /Played on October 15, 2026\./);

  const company = card({ gameMode: "company", poolKey: "anthropic", difficulty: null });
  const companyHtml = renderToStaticMarkup(createElement(SharedResult, { card: company }));
  assert.match(companyHtml, />Company</);
  assert.match(companyHtml, />Anthropic</);

  const quiet = card({ status: "given_up", score: null, breakdown: null, messageCount: 0 });
  const quietHtml = renderToStaticMarkup(createElement(SharedResult, { card: quiet }));
  assert.match(quietHtml, /Given up/);
  assert.match(quietHtml, /Try a round/);
  assert.equal(quietHtml.includes("Your score"), false);
  assert.equal(quietHtml.includes("Try to beat this score"), false);

  const hinted = card({
    breakdown: [
      { label: "Year hint", points: -100 },
      { label: "No-hint", points: null, multiplier: "×2" },
    ],
  });
  const hintedHtml = renderToStaticMarkup(createElement(SharedResult, { card: hinted }));
  assert.match(hintedHtml, />No hints</);
  assert.match(hintedHtml, /No-hint/);

  const page = fs.readFileSync(path.join(root, "app/r/[gameId]/page.tsx"), "utf8");
  const view = fs.readFileSync(path.join(root, "components/shared-result.tsx"), "utf8");
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  const played = fs.readFileSync(path.join(root, "app/play/[gameId]/result/page.tsx"), "utf8");
  assert.match(page, /SharedResult/);
  assert.match(page, /shareCardPath/);
  assert.doesNotMatch(page, /SharePicture|ShareActions|MessageBubble|transcript/);
  assert.match(view, /Try to beat this score/);
  assert.doesNotMatch(view, /ShareActions|MessageBubble|transcript/);
  assert.doesNotMatch(layout, /startsWith\("\/r\/"\)/);
  assert.match(played, /MessageBubble/);
  assert.match(played, /transcript/);
  assert.match(played, /shareText/);
  assert.match(played, /game\.model/);
  assert.doesNotMatch(played, /Model hidden|modelHidden/);
  const scoreCard = fs.readFileSync(path.join(root, "components/score-card.tsx"), "utf8");
  assert.match(scoreCard, /How scoring works/);
  assert.doesNotMatch(view, /How scoring works/);
  const profile = fs.readFileSync(path.join(root, "lib/profile-data.ts"), "utf8");
  assert.match(profile, /modelName: finished \? \(frozen\?\.name/);
  assert.doesNotMatch(profile, /Model hidden|modelHidden/);
  assert.equal(shareGameTitle("Gael"), "Gael's game");
  assert.equal(shareGameTitle(null), null);
  assert.equal(sharePlayedLine("October 16, 2026"), "Played on October 16, 2026.");
  assert.equal(sharePlayedLine(null), null);
  assert.equal(sharePlayedOn("2026-10-16T00:30:00.000Z"), "October 16, 2026");
  assert.equal(sharePlayedOn("not-a-date"), null);
});

test("share comes before download, and the networks live in one menu", () => {
  const html = renderToStaticMarkup(
    createElement(ShareActions, { gameId: "11111111-1111-4111-8111-111111111111", text: "Solved" }),
  );
  assert.match(html, /class="button"[^>]*>Share<svg[\s\S]*Copy link[\s\S]*Download<span class="share-download-extra"> card<\/span>/);
  assert.equal(html.includes("The message is copied. Paste it into the post."), false);
  assert.equal(html.match(/This opens the post\. Paste the message\./g)?.length, 2);
  assert.equal(html.includes("Instagram"), false);
  assert.match(html, /share-message[\s\S]*<svg[\s\S]*By message/);
  assert.equal(html.includes("share-menu-copy"), false);
  const actions = fs.readFileSync(path.join(root, "components/share-actions.tsx"), "utf8");
  assert.match(actions, /setNote\("Try again\."\)/);
  assert.doesNotMatch(actions, /share-menu-copy/);
  assert.doesNotMatch(actions, /setNote\("The link is copied\."\)/);
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.score-card \.score-link \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*?\.share-download-extra \{ display: none; \}/);
  assert.doesNotMatch(css, /\.share-download\.is-short/);
  assert.match(css, /\.share-note\.is-error \{ color: var\(--miss-press\); \}/);
  assert.doesNotMatch(css, /\.share-actions \.share-copy \{ display: none; \}/);
  assert.equal(html.includes(">Message<"), false);
  assert.equal(html.includes("share-phone"), false);
  assert.match(html, /share-caret/);
  assert.match(html, /share-network-menu" [^>]*hidden/);
  assert.match(html, />X</);
  assert.ok(html.indexOf(">LinkedIn<") < html.indexOf(">Facebook<"));
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
  assert.match(load, /id, status, game_mode, pool_key, pool_model_ids, difficulty, message_count, score, score_breakdown, model_id, traits, daily_key, username, finished_at/);
  assert.doesNotMatch(load, /from\("messages"\)/);
  assert.doesNotMatch(load, /from\("usage"\)/);
  assert.match(load, /from\("guesses"\)\.select\("guessed_origin"\)/);
  assert.equal(load.split('from("guesses")').length, 2);
  assert.doesNotMatch(`${load}\n${route}\n${page}`, /\.storage|writeFile/);
  assert.doesNotMatch(page, /MessageBubble|transcript|SharePicture|ShareActions/);
  assert.match(route, /card\.png|ImageResponse|shareCardImage/);
});

test("the score label names the player on a shared round and truncates long names", () => {
  assert.equal(scoreLabel("Gael", true), "Your score");
  assert.equal(scoreLabel("Gael", false), "Gael's score");
  assert.equal(scoreLabel("Chris", false), "Chris's score");
  assert.equal(scoreLabel(null, false), "Score");
  assert.equal(scoreLabel("  ", false), "Score");
  assert.equal(scoreLabel("a".repeat(30), false), `${"a".repeat(20)}…'s score`);
  const html = renderToStaticMarkup(createElement(SharedResult, { card: card({ playerName: "<b>x</b>" }) }));
  assert.equal(html.includes("<b>x"), false);
});
