export const config = {
  messageLimit: 10,
  maxUserChars: 500,
  maxOutputTokens: 500,
  modelBase: 1000,
  regionPoints: 100,
  companyPoints: 300,
  tokenScale: 1000,
  hintCost: 100,
  wrongGuessCost: 50,
  noHintMultiplier: 1.5,
  hourlyCap: 10,
  tipUrl: "",
} as const;

export type Rules = {
  messageLimit: number;
  maxUserChars: number;
  maxOutputTokens: number;
  modelBase: number;
  regionPoints: number;
  companyPoints: number;
  tokenScale: number;
  hintCost: number;
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
    hintCost: config.hintCost,
    wrongGuessCost: config.wrongGuessCost,
    noHintMultiplier: config.noHintMultiplier,
    hintsAllowed,
  };
}
