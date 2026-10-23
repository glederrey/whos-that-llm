import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  difficultyCounts,
  fail,
  first,
  fromRpc,
  guessFlags,
  mapCatalog,
  presentLogo,
  presentTraits,
  previousGuesses,
  recordedGuesses,
  sortTranscript,
} from "./rounds-shape";
import type { Traits } from "./game";

const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const savedKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
afterEach(() => {
  if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  if (savedKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = savedKey;
});

function noSupabaseEnv() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

test("fromRpc maps each rpc error to its http failure", () => {
  assert.equal(fromRpc({ ok: true }), null);
  assert.deepEqual(fromRpc({ ok: false, error: "paused" }), { status: 503, error: "paused" });
  assert.deepEqual(fromRpc({ ok: false, error: "not_found" }), { status: 404, error: "not_found" });
  assert.deepEqual(fromRpc({ ok: false, error: "username" }), { status: 422, error: "username" });
  assert.deepEqual(fromRpc({ ok: false, error: "active_game", gameId: "g1" }), { status: 409, error: "active_game", gameId: "g1" });
  assert.deepEqual(fromRpc({ ok: false, error: "daily_done" }), { status: 409, error: "daily_done" });
  assert.deepEqual(fromRpc({ ok: false, error: "hourly_cap", nextAt: "t" }), { status: 429, error: "hourly_cap", nextAt: "t" });
  assert.deepEqual(fromRpc({ ok: false, error: "conflict" }), { status: 409, error: "conflict" });
  assert.deepEqual(fromRpc({ ok: false, error: "hint" }), { status: 422, error: "hint" });
});

test("fromRpc treats an unknown or missing error as a turn conflict", () => {
  assert.deepEqual(fromRpc({ ok: false, error: "whatever" }), { status: 409, error: "turn" });
  assert.deepEqual(fromRpc({ ok: false }), { status: 409, error: "turn" });
});

test("fail adds the extra fields after status and error", () => {
  assert.deepEqual(fail(429, "x", { nextAt: "n" }), { status: 429, error: "x", nextAt: "n" });
});

test("first takes the head of an array, or the value itself", () => {
  assert.equal(first([1, 2]), 1);
  assert.equal(first([]), null);
  assert.equal(first(null), null);
  assert.deepEqual(first({ a: 1 }), { a: 1 });
});

test("presentLogo returns the stored path without a Supabase url", () => {
  noSupabaseEnv();
  assert.equal(presentLogo("logos/acme.svg", "acme"), presentLogo("", "acme"));
  assert.equal(presentLogo("https://cdn.example/x.png", "acme"), "https://cdn.example/x.png");
});

test("presentLogo builds a public url when the Supabase url is set", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "k";
  const url = presentLogo("https://cdn.example/x.png", "acme");
  assert.ok(url.startsWith("https://"), url);
  assert.notEqual(url, "");
});

test("difficultyCounts counts each pool, nested by difficulty", () => {
  const counts = difficultyCounts([
    { difficulty: "easy" },
    { difficulty: "medium" },
    { difficulty: "hard" },
    { difficulty: "impossible" },
  ]);
  assert.equal(counts.easy, 1);
  assert.equal(counts.impossible, 4);
  assert.ok(counts.medium >= counts.easy && counts.hard >= counts.medium);
  assert.deepEqual(difficultyCounts([]), { easy: 0, medium: 0, hard: 0, impossible: 0 });
});

const catalogRow = {
  id: "m1",
  name: "Model One",
  company_id: "acme",
  size: "large",
  released_on: "2024-05-17",
  difficulty: 2,
  logo_path: null,
  openrouter_id: "acme/one",
  provider_settings: { a: 1 },
  companies: { name: "Acme", origin: "us", logo_path: "logos/acme.svg" },
};

test("mapCatalog shapes a model row and takes the year from the release date", () => {
  noSupabaseEnv();
  const [model] = mapCatalog([catalogRow]);
  assert.equal(model.id, "m1");
  assert.equal(model.companyName, "Acme");
  assert.equal(model.origin, "us");
  assert.equal(model.year, 2024);
  assert.equal(model.difficulty, "medium");
  assert.equal(model.openrouterId, "acme/one");
  assert.deepEqual(model.providerSettings, { a: 1 });
  assert.equal(model.logoPath, presentLogo("logos/acme.svg", "acme"));
});

test("mapCatalog accepts the company as a one-item array and prefers the model logo", () => {
  noSupabaseEnv();
  const [model] = mapCatalog([
    { ...catalogRow, logo_path: "https://cdn.example/m.png", companies: [{ name: "Acme", origin: "us", logo_path: "logos/acme.svg" }] },
  ]);
  assert.equal(model.companyName, "Acme");
  assert.equal(model.logoPath, "https://cdn.example/m.png");
});

test("mapCatalog drops rows with no difficulty, no release date or no company", () => {
  assert.deepEqual(mapCatalog([{ ...catalogRow, difficulty: null }]), []);
  assert.deepEqual(mapCatalog([{ ...catalogRow, difficulty: 9 }]), []);
  assert.deepEqual(mapCatalog([{ ...catalogRow, released_on: null }]), []);
  assert.deepEqual(mapCatalog([{ ...catalogRow, companies: null }]), []);
  assert.deepEqual(mapCatalog([{ ...catalogRow, companies: [] }]), []);
  assert.equal(mapCatalog([catalogRow, { ...catalogRow, id: "m2", companies: null }]).length, 1);
});

test("presentTraits keeps the shown trait keys and trims each model to public fields", () => {
  noSupabaseEnv();
  const traits = {
    given: ["company", "origin", "year", "size", "name", "hidden"],
    models: {
      m1: {
        name: "One",
        companyId: "acme",
        companyName: "Acme",
        origin: "us",
        size: "large",
        year: 2024,
        logoPath: "logos/acme.svg",
        openrouterId: "secret",
      },
    },
  } as unknown as Traits;
  const shown = presentTraits(traits);
  assert.deepEqual(shown.given, ["company", "origin", "year", "size"]);
  assert.deepEqual(Object.keys(shown.models.m1).sort(), ["companyId", "companyName", "logoPath", "name", "origin", "size", "year"]);
  assert.equal(shown.models.m1.logoPath, presentLogo("logos/acme.svg", "acme"));
});

test("recordedGuesses defaults the turn and keeps any non-empty origin id", () => {
  const rows = recordedGuesses([
    { guessed_model_id: "a", guessed_origin: "us", model_correct: true, company_correct: false, origin_correct: true, turn: 3 },
    { guessed_model_id: null, guessed_origin: "mars", model_correct: false, company_correct: false, origin_correct: false },
    { guessed_model_id: "b", guessed_origin: "cn", model_correct: false, company_correct: true, origin_correct: false },
    { guessed_model_id: "c", guessed_origin: "eu", model_correct: false, company_correct: false, origin_correct: false },
  ]);
  assert.deepEqual(rows[0], { turn: 3, modelId: "a", origin: "us", modelCorrect: true, companyCorrect: false, originCorrect: true });
  assert.equal(rows[1].turn, 0);
  assert.equal(rows[1].origin, "mars");
  assert.equal(rows[1].modelId, null);
  assert.equal(rows[2].origin, "cn");
  assert.equal(rows[3].origin, "eu");
});

test("sortTranscript orders by turn, user before assistant, without changing the input", () => {
  const input = [
    { turn: 2, role: "assistant", content: "c" },
    { turn: 1, role: "assistant", content: "b" },
    { turn: 1, role: "user", content: "a" },
    { turn: 2, role: "user", content: "x" },
  ];
  const copy = structuredClone(input);
  assert.deepEqual(
    sortTranscript(input).map((m) => m.content),
    ["a", "b", "x", "c"],
  );
  assert.deepEqual(input, copy);
});

test("guessFlags coerces the correctness columns to booleans", () => {
  assert.deepEqual(guessFlags([{ model_correct: 1, company_correct: null, origin_correct: "x" }]), [
    { modelCorrect: true, companyCorrect: false, originCorrect: true },
  ]);
  assert.deepEqual(guessFlags([]), []);
});

test("previousGuesses keeps the guessed model and origin next to the flags", () => {
  assert.deepEqual(
    previousGuesses([
      { guessed_model_id: "a", guessed_origin: "eu", model_correct: false, company_correct: true, origin_correct: true },
    ]),
    [{ modelId: "a", origin: "eu", modelCorrect: false, companyCorrect: true, originCorrect: true }],
  );
});
