import type { Difficulty } from "./difficulty";
import type { HintKey } from "./game";

export const config = {
  messageLimit: 10,
  maxUserChars: 500,
  maxOutputTokens: 1000,
  modelBase: 2000,
  regionPoints: 100,
  companyPoints: 300,
  tokenScale: 10000,
  tokenCap: 10,
  hintCosts: { year: 100, size: 100, region: 400, company: 600 },
  wrongGuessCost: 100,
  noHintMultiplier: 2,
  difficultyMultipliers: { easy: 0.5, medium: 1, hard: 1.5, impossible: 2 } satisfies Record<Difficulty, number>,
  hourlyCap: 20,
  tipUrl: "https://ko-fi.com/glederrey",
} as const;

export type Rules = {
  messageLimit: number;
  maxUserChars: number;
  maxOutputTokens: number;
  modelBase: number;
  regionPoints: number;
  companyPoints: number;
  tokenScale: number;
  tokenCap: number;
  hintCosts: Record<HintKey, number>;
  wrongGuessCost: number;
  noHintMultiplier: number;
  difficultyMultipliers: Record<Difficulty, number>;
  hintsAllowed: boolean;
};

export function rulesForCategory(hintsAllowed: boolean): Rules {
  return {
    messageLimit: config.messageLimit,
    maxUserChars: config.maxUserChars,
    maxOutputTokens: config.maxOutputTokens,
    modelBase: config.modelBase,
    regionPoints: config.regionPoints,
    companyPoints: config.companyPoints,
    tokenScale: config.tokenScale,
    tokenCap: config.tokenCap,
    hintCosts: { ...config.hintCosts },
    wrongGuessCost: config.wrongGuessCost,
    noHintMultiplier: config.noHintMultiplier,
    difficultyMultipliers: { ...config.difficultyMultipliers },
    hintsAllowed,
  };
}

export function currentRules(stored: Rules): Rules {
  return { ...stored, ...rulesForCategory(stored.hintsAllowed), messageLimit: stored.messageLimit };
}
