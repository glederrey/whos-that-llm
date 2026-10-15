import { difficultyFromStored, difficultyLabel, type Difficulty } from "./difficulty";
import { isFinishedGame, poolLabel, type ScoreLine, type Traits } from "./game";
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
  /** Hidden on Daily. Other modes may name the model. */
  modelName: string | null;
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

function hiddenModelName(traits: Traits, modelId: string): string | null {
  const name = traits.models[modelId]?.name?.trim() ?? "";
  return name.length > 0 ? name : null;
}

function outcomeFor(status: string): ShareOutcome {
  if (status === "solved") return "Solved";
  if (status === "miss") return "Not solved";
  return "Given up";
}

/** A finished round's public card. Daily never carries the hidden model name. An open round has no card. */
export function buildShareCard(input: ShareCardInput): ShareCard | null {
  if (!isFinishedGame(input.status)) return null;
  const difficulty = difficultyFromStored(input.difficulty);
  const daily = input.gameMode === "daily";
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
    modelName: daily ? null : hiddenModelName(input.traits, input.modelId),
    details: detailsFrom(input.breakdown),
    hints: hintsLine(input.breakdown),
    invite: input.score === null ? "Come try a round" : `Can you beat ${formatShareNumber(input.score)}?`,
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

export type ShareCardDisplay = {
  title: typeof shareBrand;
  mode: string;
  variant: string | null;
  /** Set only when the variant is a difficulty name. */
  variantColor: string | null;
  score: string;
  outcome: ShareOutcome;
  modelName: string | null;
  messagesLabel: "Messages";
  messages: string;
  tokensLabel: "Tokens";
  tokens: string;
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
  return {
    title: shareBrand,
    mode,
    variant,
    variantColor: colored,
    score: card.score === null ? "—" : formatShareNumber(card.score),
    outcome: card.outcome,
    modelName: card.modelName,
    messagesLabel: "Messages",
    messages: formatShareNumber(card.messages),
    tokensLabel: "Tokens",
    tokens: card.tokens === null ? "—" : formatShareNumber(card.tokens),
    details: card.details,
    hints: card.hints,
    invite: card.invite,
    site: shareSite,
  };
}

/** A sentence for X, Facebook, and the phone share sheet. Daily still hides the model. */
export function shareText(card: ShareCard): string {
  const place = card.modeLine.replace(" · ", ", ");
  const score = card.score === null ? null : formatShareNumber(card.score);
  const model = card.modelName ? ` It was ${card.modelName}.` : "";
  if (card.outcome === "Solved") {
    if (!score) return `I solved a round of ${shareBrand} ${place}.${model}`;
    return `I scored ${score} on ${shareBrand} ${place}.${model} Can you beat it?`;
  }
  if (card.outcome === "Not solved") {
    if (!score) return `I missed the model on ${shareBrand} ${place}.${model}`;
    return `I scored ${score} on ${shareBrand} ${place}, and missed the model.${model}`;
  }
  if (!score) return `I gave up on ${shareBrand} ${place}. Come try a round.`;
  return `I scored ${score} on ${shareBrand} and gave up. ${place}.${model}`;
}

export function xShareUrl(pageUrl: string, text: string): string {
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set("text", text);
  url.searchParams.set("url", pageUrl);
  return url.toString();
}

export function facebookShareUrl(pageUrl: string, text: string): string {
  const url = new URL("https://www.facebook.com/sharer/sharer.php");
  url.searchParams.set("u", pageUrl);
  url.searchParams.set("quote", text);
  return url.toString();
}

/** LinkedIn takes the page URL. The preview comes from the card image. */
export function linkedInShareUrl(pageUrl: string): string {
  const url = new URL("https://www.linkedin.com/sharing/share-offsite/");
  url.searchParams.set("url", pageUrl);
  return url.toString();
}

/** Bluesky puts the sentence and the link in the draft. */
export function blueskyShareUrl(pageUrl: string, text: string): string {
  const url = new URL("https://bsky.app/intent/compose");
  url.searchParams.set("text", `${text} ${pageUrl}`);
  return url.toString();
}
