import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { originIdFromName, parseOriginFields, parseOriginId } from "./admin-origin";
import { parseOrigin } from "./admin-model";
import { originChoiceFor, originChoices, type FrozenModel, type Traits } from "./game";

const root = path.resolve(import.meta.dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261023124535_origin_mode.sql"), "utf8");

function frozen(origin: string, extra: Partial<FrozenModel> = {}): FrozenModel {
  return {
    name: origin,
    companyId: origin,
    companyName: origin,
    origin,
    size: "small",
    year: 2026,
    logoPath: "logos/x.png",
    ...extra,
  };
}

test("origin ids come from a name, and only clean ids pass", () => {
  assert.equal(originIdFromName("Latin America"), "latin-america");
  assert.equal(originIdFromName("  "), null);
  assert.equal(originIdFromName("123"), null);
  assert.equal(parseOriginId("us"), "us");
  assert.equal(parseOriginId("US"), null);
  assert.equal(parseOriginId("a b"), null);
  assert.equal(parseOrigin("China"), "cn");
  assert.equal(parseOrigin("latam"), "latam");
  assert.equal(parseOrigin("Latin America"), null);
});

test("origin fields need a name, one emoji, and a whole order", () => {
  assert.deepEqual(parseOriginFields({ name: " Japan ", flag: "🇯🇵", sortOrder: "4" }), { name: "Japan", flag: "🇯🇵", sortOrder: 4 });
  assert.equal(parseOriginFields({ name: "Japan", flag: "🇯🇵" })?.sortOrder, 100);
  assert.equal(parseOriginFields({ name: "", flag: "🇯🇵" }), null);
  assert.equal(parseOriginFields({ name: "Japan", flag: "" }), null);
  assert.equal(parseOriginFields({ name: "Japan", flag: "🇯🇵", sortOrder: "1.5" }), null);
  assert.equal(parseOriginFields({ name: "x".repeat(41), flag: "🇯🇵" }), null);
});

test("the Origin buttons come from the pool, in the admin order", () => {
  const traits: Traits = {
    given: [],
    models: {
      a: frozen("eu", { originName: "Europe", originFlag: "🇪🇺", originSort: 3 }),
      b: frozen("us", { originName: "USA", originFlag: "🇺🇸", originSort: 1 }),
      c: frozen("us", { originName: "USA", originFlag: "🇺🇸", originSort: 1 }),
      d: frozen("jp", { originName: "Japan", originFlag: "🇯🇵", originSort: 2 }),
    },
  };
  assert.deepEqual(
    originChoices(traits).map((choice) => choice.id),
    ["us", "jp", "eu"],
  );
  assert.equal(originChoiceFor(traits, "jp").flag, "🇯🇵");
  assert.equal(originChoiceFor(traits, "cn").name, "China");
});

test("the Origin guess function binds its inputs and the round must be an Origin round", () => {
  const body = migration.slice(migration.indexOf("create function public.apply_origin_guess"));
  assert.ok(!/\bexecute\b/i.test(body.split("$$;")[0]));
  assert.ok(!/format\s*\(/i.test(body.split("$$;")[0]));
  assert.match(body, /g\.game_mode <> 'origin'/);
  assert.match(body, /from public\.origins where id = p_origin/);
  assert.match(body, /grant execute on function public\.apply_origin_guess\(uuid, uuid, text, boolean\) to service_role/);
  assert.match(body, /revoke all on function public\.apply_origin_guess\(uuid, uuid, text, boolean\) from public, anon, authenticated/);
});

test("origins link to companies and guesses, are never deleted, and can be turned off", () => {
  assert.match(migration, /enabled boolean not null default true/);
  assert.match(migration, /companies_origin_fkey foreign key \(origin\) references public\.origins \(id\)/);
  assert.match(migration, /guesses_guessed_origin_fkey foreign key \(guessed_origin\) references public\.origins \(id\)/);
  assert.match(migration, /grant select, insert, update on public\.origins to service_role/);
  assert.match(migration, /revoke delete, truncate on table public\.origins from service_role/);
  assert.match(migration, /alter table public\.origins enable row level security/);
  assert.ok(!/grant[^;]*\bdelete\b[^;]*to service_role/i.test(migration.replace(/revoke[^;]*;/gi, "")));
});

test("the rename reaches the stored rounds and the hint key", () => {
  assert.match(migration, /array_replace\(hints, 'region', 'origin'\)/);
  assert.match(migration, /jsonb_build_object\('origin', e\.m -> 'region'\)/);
  assert.match(migration, /p_key not in \('company', 'origin', 'year', 'size'\)/);
  assert.match(migration, /update public\.games set game_mode = 'origin' where game_mode = 'region'/);
});

test("Origin mode starts from the origins that are turned on", () => {
  const source = fs.readFileSync(path.join(root, "lib/rounds-start.ts"), "utf8");
  assert.match(source, /from\("origins"\)\.select\("id"\)\.eq\("enabled", true\)/);
  assert.match(source, /pool_too_small/);
});
