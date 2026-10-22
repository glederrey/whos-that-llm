import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoreCard } from "../components/score-card";
import { rulesForGameMode } from "./config";
import { allCompanies, companyModelCounts, parseBoardCompany } from "./company";
import { buildTraits, gameModeAllowsHints, hintAllowedForMode, hintOffered, poolLabel, scoreRound, type Traits } from "./game";

const root = path.resolve(import.meta.dirname, "..");

test("a company count includes only models that are turned on", () => {
  const companies = [
    { id: "openai", name: "OpenAI" },
    { id: "anthropic", name: "Anthropic" },
    { id: "mistral", name: "Mistral" },
  ];
  const models = [
    { companyId: "openai", enabled: true },
    { companyId: "openai", enabled: true },
    { companyId: "openai", enabled: false },
    { companyId: "anthropic", enabled: false },
    { companyId: "anthropic", enabled: false },
  ];
  assert.deepEqual(companyModelCounts(companies, models), [
    { id: "openai", name: "OpenAI", models: 2 },
    { id: "anthropic", name: "Anthropic", models: 0 },
    { id: "mistral", name: "Mistral", models: 0 },
  ]);
  assert.equal(companyModelCounts(companies, [{ companyId: "mistral" }])[2].models, 1);
});

test("the company board defaults to all companies", () => {
  assert.equal(parseBoardCompany(undefined), allCompanies);
  assert.equal(parseBoardCompany("  "), allCompanies);
  assert.equal(parseBoardCompany("ALL"), allCompanies);
  assert.equal(parseBoardCompany("Anthropic"), "anthropic");
  assert.equal(parseBoardCompany("anthropic"), "anthropic");
  assert.equal(parseBoardCompany("x-ai"), "x-ai");
  assert.equal(parseBoardCompany("../openai"), allCompanies);
});

test("a finished company round scores like all models, and the company takes the difficulty's place", () => {
  const rules = rulesForGameMode(false);
  const shared = {
    rules,
    namedModel: true,
    regionMatched: true,
    companyMatched: true,
    regionGiven: true,
    companyGiven: true,
    tokens: 500,
    noHint: false,
    hints: [],
  };
  const company = scoreRound(shared);
  const easy = scoreRound({ ...shared, difficulty: "easy" });
  assert.equal(company.breakdown.some((line) => line.label.startsWith("Difficulty")), false);
  assert.equal(easy.breakdown.some((line) => line.label.startsWith("Difficulty")), true);
  assert.equal(company.score, 40000);
  assert.equal(easy.score, 20000);
  const withYear = scoreRound({ ...shared, rules: rulesForGameMode(true), hints: ["year"] });
  assert.equal(withYear.breakdown.some((line) => line.label === "Year hint" && line.points === -100), true);
  assert.equal(withYear.score, 38000);
  const blind = scoreRound({ ...shared, rules: rulesForGameMode(true), noHint: true });
  assert.equal(blind.breakdown.some((line) => line.label === "No-hint"), true);
  assert.equal(blind.score, 80000);

  const traits: Traits = {
    given: ["company", "region"],
    models: {
      haiku: {
        name: "Haiku",
        companyId: "anthropic",
        companyName: "Anthropic",
        region: "us",
        size: "small",
        year: 2026,
        logoPath: "logos/anthropic.png",
      },
    },
  };
  assert.equal(poolLabel("company", "anthropic", traits, null), "Company · Anthropic");
  assert.equal(poolLabel("all", null, traits, "hard"), "All models · Hard");

  const html = renderToStaticMarkup(
    createElement(ScoreCard, {
      model: null,
      score: company.score,
      messages: 2,
      state: "solved",
      mode: "Company",
      difficulty: null,
      place: { label: "Company", value: "Anthropic" },
      noHint: false,
      breakdown: company.breakdown,
      share: null,
    }),
  );
  assert.match(html, /Game mode/);
  assert.match(html, /Company/);
  assert.match(html, /Anthropic/);
  assert.equal(html.includes("Difficulty"), false);
});

test("a company round can buy the year and the size, and not the lab or the region", () => {
  assert.equal(gameModeAllowsHints("company"), true);
  assert.equal(hintAllowedForMode("company", "year"), true);
  assert.equal(hintAllowedForMode("company", "size"), true);
  assert.equal(hintAllowedForMode("company", "company"), false);
  assert.equal(hintAllowedForMode("company", "region"), false);
  assert.equal(hintAllowedForMode("region", "year"), false);

  const traits = buildTraits([
    {
      id: "haiku",
      name: "Haiku",
      companyId: "anthropic",
      companyName: "Anthropic",
      region: "us",
      size: "small",
      year: 2024,
      logoPath: "logos/anthropic.png",
    },
    {
      id: "opus",
      name: "Opus",
      companyId: "anthropic",
      companyName: "Anthropic",
      region: "us",
      size: "large",
      year: 2026,
      logoPath: "logos/anthropic.png",
    },
  ]);
  const hidden = traits.models.opus;
  assert.ok(hidden);
  assert.deepEqual(traits.given, ["company", "region"]);
  const offer = (key: "company" | "region" | "year" | "size") =>
    hintOffered({ key, traits, hidden, guesses: [], hints: [], noHint: false });
  assert.equal(offer("company"), false);
  assert.equal(offer("region"), false);
  assert.equal(offer("year"), true);
  assert.equal(offer("size"), true);

  const sql = fs.readFileSync(path.join(root, "supabase/migrations/20261021080000_baseline.sql"), "utf8");
  assert.match(sql, /\('company', 'Company', '[^']*', true, true, true, 3\)/);
  const home = fs.readFileSync(path.join(root, "components/home-board.tsx"), "utf8");
  assert.match(home, /gameMode: mode, companyId: poolId, noHint/);
  assert.match(home, /Play without hints/);
  const board = fs.readFileSync(path.join(root, "components/round-board.tsx"), "utf8");
  assert.match(board, /game\.gameMode === "company"/);
});

test("company mode is enabled in the schema", () => {
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/20261021080000_baseline.sql"), "utf8");
  assert.match(sql, /\('company', 'Company', '[^']*', true, true, true, 3\)/);
  assert.match(sql, /\('class', 'Category', '.*', false, false, false, 4\)/);
  assert.match(sql, /p_company text default null/);
  assert.match(sql, /g\.pool_key = leaderboard\.p_company/);
  assert.match(sql, /leaderboard\.game_mode = 'company'/);
  assert.match(sql, /games_one_active_per_company_idx/);
  assert.match(sql, /pool_key is not distinct from p_pool_key/);
  assert.match(sql, /as company_name/);
  assert.match(sql, /as company_logo/);
  const home = fs.readFileSync(path.join(root, "components/home-board.tsx"), "utf8");
  assert.match(home, /\["daily", "all", "company", "class", "region", "custom"\]/);
  assert.match(home, /Choose company/);
  assert.match(home, /CompanyLogo/);
  assert.match(home, /companyModelCounts|company\.models/);
});
