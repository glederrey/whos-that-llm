import type { HintKey } from "./game";

export const config = {
  messageLimit: 10,
  maxUserChars: 500,
  maxOutputTokens: 1000,
  modelBase: 2000,
  regionPoints: 100,
  companyPoints: 300,
  tokenScale: 1000,
  tokenFloor: 100,
  hintCosts: { year: 100, size: 100, region: 400, company: 600, family: 600 },
  wrongGuessCost: 100,
  noHintMultiplier: 2,
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
  tokenFloor: number;
  hintCosts: Record<HintKey, number>;
  wrongGuessCost: number;
  noHintMultiplier: number;
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
    tokenFloor: config.tokenFloor,
    hintCosts: { ...config.hintCosts },
    wrongGuessCost: config.wrongGuessCost,
    noHintMultiplier: config.noHintMultiplier,
    hintsAllowed,
  };
}

export function currentRules(stored: Rules): Rules {
  return { ...stored, ...rulesForCategory(stored.hintsAllowed), messageLimit: stored.messageLimit };
}
