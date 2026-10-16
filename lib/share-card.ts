import { difficultyFromStored, difficultyLabel, type Difficulty } from "./difficulty";
import {
  isFinishedGame,
  poolLabel,
  regionLabel,
  scoreSteps,
  sizeLabel,
  type ScoreLine,
  type ScoreStep,
  type Traits,
} from "./game";
import { utcDayKey } from "./daily";
import { siteOrigin } from "./site";

/** Leaderboard difficulty colors. The card uses these on the difficulty word. */
export const difficultyColor: Record<Difficulty, string> = {
  easy: "#1c7c43",
  medium: "#d4a017",
  hard: "#c41b15",
  impossible: "#a78bfa",
};

export const shareBrand = "Who's that LLM?";

export const shareSite = "whos-that-llm.com";

export type ShareDetail = { label: string; value: string };

/** Unique download name, so two rounds do not overwrite one file. */
export function shareFileName(gameId: string): string {
  return `whos-that-llm-${gameId}.png`;
}

export const shareOutcomes = ["Solved", "Not solved", "Given up"] as const;

export type ShareOutcome = (typeof shareOutcomes)[number];

export type ShareCard = {
  id: string;
  /** Daily · Easy, All models · Hard, Company · Anthropic, Category · Opus. */
  modeLine: string;
  difficulty: Difficulty | null;
  outcome: ShareOutcome;
  score: number | null;
  messages: number;
  /** Tokens the score counted. Null when this round has no score line. */
  tokens: number | null;
  /** Hidden on a Daily until the UTC day after that puzzle. Other modes may name the model. */
  modelName: string | null;
  /** Company logo path. Hidden with the name. */
  modelLogoPath: string | null;
  /** Company, region, year, and size. Hidden with the name. */
  modelFacts: string[];
  /** Running total, including Before the multiplier. Empty when there is no score. */
  steps: ScoreStep[];
  /** The stored breakdown, in order. Empty when this round has no score. */
  details: ShareDetail[];
  /** Set when the breakdown does not already name a hint or no-hint mode. */
  hints: string | null;
  invite: string;
};

export type ShareCardInput = {
  id: string;
  gameMode: string;
  poolKey: string | null;
  difficulty: unknown;
  status: string;
  messageCount: number;
  score: number | null;
  breakdown: ScoreLine[] | null;
  modelId: string;
  traits: Traits;
  /** Display name for a category round. The id in `poolKey` is the fallback. */
  categoryName?: string | null;
  /** `2026-10-12:1` for a Daily. Null for every other mode. */
  dailyKey?: string | null;
  /** Used to decide whether today's Daily may name the model. */
  now?: Date;
};

const gameIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isShareGameId(value: string): boolean {
  return gameIdPattern.test(value);
}

export function sharePagePath(gameId: string): string {
  return `/r/${gameId}`;
}

export function sharePageUrl(gameId: string, origin = siteOrigin): string {
  return `${origin}${sharePagePath(gameId)}`;
}

export function shareCardPath(gameId: string): string {
  return `/r/${gameId}/card.png`;
}

export type ShareCardTheme = "light" | "dark";

/** Anything other than dark stays the light card. A preview with no theme stays light. */
export function shareCardTheme(value: string | null | undefined): ShareCardTheme {
  return value === "dark" ? "dark" : "light";
}

export function shareCardImagePath(gameId: string, theme: ShareCardTheme, download = false): string {
  const query = new URLSearchParams({ theme });
  if (download) query.set("download", "1");
  return `${shareCardPath(gameId)}?${query}`;
}

/** The token total stored on the score line, not the raw prompt plus completion sum. */
export function tokensFromBreakdown(lines: ScoreLine[] | null | undefined): number | null {
  if (!lines) return null;
  for (const line of lines) {
    const match = /^Tokens · ([\d,]+) tokens$/.exec(line.label);
    if (!match) continue;
    const tokens = Number(match[1].replaceAll(",", ""));
    return Number.isFinite(tokens) ? tokens : null;
  }
  return null;
}

export function shareModeLine(input: {
  gameMode: string;
  poolKey: string | null;
  traits: Traits;
  difficulty: Difficulty | null;
  categoryName?: string | null;
}): string {
  if (input.gameMode === "class") {
    const name = (input.categoryName ?? input.poolKey ?? "").trim();
    return name ? `Category · ${name}` : "Category";
  }
  if (input.gameMode === "custom") return "Custom";
  return poolLabel(input.gameMode, input.poolKey, input.traits, input.difficulty);
}

/** The UTC day stored on a Daily round, such as `2026-10-12` from `2026-10-12:1`. */
export function dailyPuzzleDay(dailyKey: string | null | undefined): string | null {
  if (!dailyKey) return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?::[1-4])?$/.exec(dailyKey.trim());
  return match?.[1] ?? null;
}

/** A Daily model stays hidden through the UTC day of that puzzle. The next day it can be named. */
export function dailyModelVisible(dailyKey: string | null | undefined, now = new Date()): boolean {
  const day = dailyPuzzleDay(dailyKey);
  if (!day) return false;
  return day < utcDayKey(now);
}

function shownModel(traits: Traits, modelId: string, hidden: boolean) {
  if (hidden) return null;
  const model = traits.models[modelId];
  const name = model?.name?.trim() ?? "";
  if (!model || name.length === 0) return null;
  const facts = [model.companyName, regionLabel(model.region), String(model.year), sizeLabel(model.size)].filter(
    (fact) => fact.trim().length > 0,
  );
  const logoPath = model.logoPath?.trim() ?? "";
  return { name, logoPath: logoPath.length > 0 ? logoPath : null, facts };
}

function outcomeFor(status: string): ShareOutcome {
  if (status === "solved") return "Solved";
  if (status === "miss") return "Not solved";
  return "Given up";
}

/** A finished round's public card. Today's Daily does not carry the model. An open round has no card. */
export function buildShareCard(input: ShareCardInput): ShareCard | null {
  if (!isFinishedGame(input.status)) return null;
  const difficulty = difficultyFromStored(input.difficulty);
  const hideModel = input.gameMode === "daily" && !dailyModelVisible(input.dailyKey, input.now ?? new Date());
  const model = shownModel(input.traits, input.modelId, hideModel);
  return {
    id: input.id,
    modeLine: shareModeLine({
      gameMode: input.gameMode,
      poolKey: input.poolKey,
      traits: input.traits,
      difficulty,
      categoryName: input.categoryName,
    }),
    difficulty,
    outcome: outcomeFor(input.status),
    score: input.score,
    messages: input.messageCount,
    tokens: tokensFromBreakdown(input.breakdown),
    modelName: model?.name ?? null,
    modelLogoPath: model?.logoPath ?? null,
    modelFacts: model?.facts ?? [],
    steps: input.score === null || !input.breakdown ? [] : scoreSteps(input.breakdown, input.score),
    details: detailsFrom(input.breakdown),
    hints: hintsLine(input.breakdown),
    invite: input.score === null ? "Come try a round" : `Can you beat my score of ${formatShareNumber(input.score)}?`,
  };
}

function detailsFrom(lines: ScoreLine[] | null): ShareDetail[] {
  if (!lines) return [];
  return lines.map((line) => ({
    label: line.label,
    value: line.multiplier && line.multiplier.length > 0 ? line.multiplier : formatShareNumber(line.points ?? 0),
  }));
}

function hintsLine(lines: ScoreLine[] | null): string | null {
  if (!lines) return null;
  const named = lines.some((line) => line.label === "No-hint" || line.label.endsWith(" hint"));
  return named ? null : "Hints · none";
}

export function formatShareNumber(value: number): string {
  return Math.trunc(value).toLocaleString("en-US");
}

export type ShareMeta = { label: string; value: string; color: string | null };

export type ShareCardDisplay = {
  title: typeof shareBrand;
  mode: string;
  variant: string | null;
  /** Set only when the variant is a difficulty name. */
  variantColor: string | null;
  score: string;
  outcome: ShareOutcome;
  /** Solved on message 2. Miss. Given up. */
  status: string;
  meta: ShareMeta[];
  modelName: string | null;
  modelFacts: string[];
  messagesLabel: "Messages";
  messages: string;
  tokensLabel: "Tokens";
  tokens: string;
  steps: ScoreStep[];
  details: ShareDetail[];
  hints: string | null;
  invite: string;
  site: typeof shareSite;
};

export function shareCardDisplay(card: ShareCard): ShareCardDisplay {
  const splitAt = card.modeLine.indexOf(" · ");
  const mode = splitAt === -1 ? card.modeLine : card.modeLine.slice(0, splitAt);
  const variant = splitAt === -1 ? null : card.modeLine.slice(splitAt + 3);
  const colored =
    card.difficulty && variant === difficultyLabel[card.difficulty] ? difficultyColor[card.difficulty] : null;
  const meta: ShareMeta[] = [{ label: "Game mode", value: mode, color: null }];
  if (variant) {
    const isDifficulty = card.difficulty !== null && variant === difficultyLabel[card.difficulty];
    meta.push({ label: isDifficulty ? "Difficulty" : mode, value: variant, color: isDifficulty ? colored : null });
  }
  const status =
    card.outcome === "Solved"
      ? `Solved on message ${formatShareNumber(card.messages)}.`
      : card.outcome === "Not solved"
        ? "Miss."
        : "Given up.";
  return {
    title: shareBrand,
    mode,
    variant,
    variantColor: colored,
    score: card.score === null ? "—" : formatShareNumber(card.score),
    outcome: card.outcome,
    status,
    meta,
    modelName: card.modelName,
    modelFacts: card.modelFacts,
    messagesLabel: "Messages",
    messages: formatShareNumber(card.messages),
    tokensLabel: "Tokens",
    tokens: card.tokens === null ? "—" : formatShareNumber(card.tokens),
    steps: card.steps,
    details: card.details,
    hints: card.hints,
    invite: card.invite,
    site: shareSite,
  };
}

/** Alt text for the public picture. Today's Daily does not name the model. */
export function shareCardAlt(card: ShareCard): string {
  const display = shareCardDisplay(card);
  const parts = [display.title, display.mode];
  if (display.variant) parts.push(display.variant);
  parts.push(display.score, display.status);
  if (display.modelName) parts.push(display.modelName);
  return parts.join(", ");
}

/** The post for X, Facebook, LinkedIn, Instagram, and the phone share sheet. Today's Daily hides the model. */
export function shareText(card: ShareCard): string {
  const score = card.score === null ? null : formatShareNumber(card.score);
  const blocks = [
    score ? `I just played on ${shareBrand} and scored ${score} points.` : `I just played on ${shareBrand}`,
    shareFacts(card).join("\n"),
  ];
  if (card.modelName) blocks.push(`The model I had to guess was ${card.modelName}.`);
  if (score) blocks.push("Do you think you can beat my score?");
  blocks.push(sharePageUrl(card.id));
  return blocks.join("\n\n");
}

/** Phone share already attaches the card image, so the post can point at the game. */
export function shareTextForImage(text: string, pageUrl: string): string {
  if (!text.endsWith(pageUrl)) return text;
  return `${text.slice(0, -pageUrl.length)}Play here: ${siteOrigin}`;
}

/** All models and Daily name the difficulty. A company, category, or region names that instead. */
function shareFacts(card: ShareCard): string[] {
  const splitAt = card.modeLine.indexOf(" · ");
  const mode = splitAt === -1 ? card.modeLine : card.modeLine.slice(0, splitAt);
  const variant = splitAt === -1 ? null : card.modeLine.slice(splitAt + 3);
  const lines = [`Game mode: ${mode}`];
  if (!variant) return lines;
  const isDifficulty = card.difficulty !== null && variant === difficultyLabel[card.difficulty];
  lines.push(isDifficulty ? `Difficulty: ${variant}.` : `${mode}: ${variant}.`);
  return lines;
}

export function xShareUrl(pageUrl: string, text: string): string {
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set("text", text);
  if (!text.includes(pageUrl)) url.searchParams.set("url", pageUrl);
  return url.toString();
}

/** A phone post is the text alone. Play here is not followed by a second link. */
export function phoneTweetUrl(postText: string): string {
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set("text", postText);
  return url.toString();
}

export function facebookShareUrl(pageUrl: string, text: string): string {
  const url = new URL("https://www.facebook.com/sharer/sharer.php");
  url.searchParams.set("u", pageUrl);
  url.searchParams.set("quote", text);
  return url.toString();
}

/** LinkedIn takes the page URL. It does not accept a prefilled sentence. */
export function linkedInShareUrl(pageUrl: string): string {
  const url = new URL("https://www.linkedin.com/sharing/share-offsite/");
  url.searchParams.set("url", pageUrl);
  return url.toString();
}
