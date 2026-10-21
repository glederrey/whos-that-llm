import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function bindsParameter(body: string, parameter: string): boolean {
  if (!new RegExp(`\\b${parameter}\\b`).test(body)) return false;
  if (new RegExp(`execute[\\s\\S]{0,200}\\b${parameter}\\b`, "i").test(body)) return false;
  if (new RegExp(`format\\s*\\([\\s\\S]{0,200}\\b${parameter}\\b`, "i").test(body)) return false;
  if (body.includes(`|| ${parameter}`) || body.includes(`${parameter} ||`)) return false;
  if (body.includes("${" + parameter + "}")) return false;
  return true;
}

function latestFunction(name: string): string {
  const dir = path.join(root, "supabase/migrations");
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  const pattern = new RegExp(`create (?:or replace )?function public\\.${name}\\b[\\s\\S]*?\\$\\$;`, "gi");
  let body = "";
  for (const file of files) {
    const matches = fs.readFileSync(path.join(dir, file), "utf8").match(pattern);
    if (matches?.length) body = matches[matches.length - 1] ?? "";
  }
  assert.notEqual(body, "", name);
  return body;
}

function sourceFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, name);
  const head = /\)\s*(?::[^{]+)?\{/.exec(source.slice(start));
  if (!head) throw new Error(name);
  const open = start + head.index + head[0].length - 1;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(name);
}

function valueIsBound(source: string, expression: string): boolean {
  if (source.includes("${" + expression + "}")) return false;
  if (source.includes(" + " + expression) || source.includes(expression + " + ")) return false;
  return source.includes(expression);
}

test("a concatenated value is rejected and a bound parameter is kept", () => {
  const interpolated = "execute format('select note from notes where note = %L', marker)";
  const bound = "update public.notes set note = marker where id = uid";
  assert.equal(bindsParameter(interpolated, "marker"), false);
  assert.equal(bindsParameter(bound, "marker"), true);
});

test("username create, update, and lookup bind the value", () => {
  const username = latestFunction("set_username");
  assert.equal(bindsParameter(username, "p_username"), true);
  assert.equal(bindsParameter(username, "cleaned"), true);
  assert.doesNotMatch(username, /execute|format\s*\(/i);
  const lookup = latestFunction("start_game");
  assert.match(lookup, /select username into profile_name from public\.profiles where id = p_user_id/);
  assert.equal(bindsParameter(lookup, "profile_name"), true);
  assert.doesNotMatch(lookup, /execute|format\s*\(/i);
  const source = fs.readFileSync(path.join(root, "lib/rounds-queries.ts"), "utf8");
  const setter = sourceFunction(source, "saveUsername");
  assert.equal(valueIsBound(setter, "raw"), true);
  assert.match(setter, /rpc\("set_username", \{ p_username: raw \}\)/);
});

test("a chat message and a guess are bound on the way in, out, and when saved", () => {
  const reply = latestFunction("apply_reply");
  assert.equal(bindsParameter(reply, "p_user_text"), true);
  assert.equal(bindsParameter(reply, "p_assistant_text"), true);
  assert.doesNotMatch(reply, /execute|format\s*\(/i);
  const guess = latestFunction("apply_guess");
  assert.equal(bindsParameter(guess, "p_model_id"), true);
  assert.doesNotMatch(guess, /execute|format\s*\(/i);

  const rounds = fs.readFileSync(path.join(root, "lib/rounds-play.ts"), "utf8");
  const save = sourceFunction(rounds, "saveReply");
  const submit = sourceFunction(rounds, "submitGuess");
  const hidden = sourceFunction(rounds, "hiddenCall");
  const read = sourceFunction(rounds, "readPublicGame");
  assert.equal(valueIsBound(save, "userText"), true);
  assert.match(save, /p_user_text: userText/);
  assert.match(save, /p_assistant_text: assistantText/);
  assert.equal(valueIsBound(submit, "modelId"), true);
  assert.match(submit, /p_model_id: modelId/);
  assert.match(hidden, /\.select\("turn, role, content"\)/);
  assert.match(hidden, /\.eq\("game_id", gameId\)/);
  assert.equal(hidden.includes("${"), false);
  assert.match(read, /\.select\("turn, role, content"\)/);
  assert.match(read, /\.eq\("game_id", gameId\)/);
  assert.equal(read.includes("${"), false);

  const messages = fs.readFileSync(path.join(root, "app/api/games/[id]/messages/route.ts"), "utf8");
  const guesses = fs.readFileSync(path.join(root, "app/api/games/[id]/guesses/route.ts"), "utf8");
  const played = sourceFunction(fs.readFileSync(path.join(root, "lib/openrouter.ts"), "utf8"), "streamPlayedReply");
  assert.equal(messages.includes("${trimmed}"), false);
  assert.equal(messages.includes("${text}"), false);
  assert.match(messages, /userText: trimmed/);
  assert.match(played, /content: input\.userText/);
  assert.equal(played.includes("${"), false);
  assert.equal(guesses.includes("${"), false);
  assert.match(guesses, /submitGuess\(id, user\.id, body\.modelId\)/);
});
