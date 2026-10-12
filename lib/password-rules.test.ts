import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { isWeakPasswordError, passwordProblem, passwordRulesText, passwordStrength, weakPasswordNotice } from "./password-rules";

const root = path.resolve(import.meta.dirname, "..");

test("a short password names the missing length", () => {
  assert.equal(passwordProblem("Abcdef!"), "Password needs at least 8 characters.");
  assert.equal(passwordStrength("Abcdef!"), 3);
});

test("a password without a symbol names the symbol", () => {
  assert.equal(passwordProblem("Abcdefgh"), "Password needs a symbol.");
  assert.equal(passwordStrength("Abcdefgh"), 3);
});

test("a password that meets every rule is accepted", () => {
  assert.equal(passwordProblem("Abcdefg!"), null);
  assert.equal(passwordStrength("Abcdefg!"), 4);
});

test("several missing rules are listed together", () => {
  assert.equal(passwordProblem("abcdefg"), "Password needs at least 8 characters, an uppercase letter, and a symbol.");
  assert.equal(passwordProblem(""), "Password needs at least 8 characters, a lowercase letter, an uppercase letter, and a symbol.");
});

test("a weak-password response uses the same missing-rule message", () => {
  const weak = { code: "weak_password", name: "AuthWeakPasswordError", message: "Password is known to be weak" };
  assert.equal(weakPasswordNotice("Abcdefgh", weak), "Password needs a symbol.");
  assert.equal(weakPasswordNotice("Abcdef!", weak), "Password needs at least 8 characters.");
  assert.equal(weakPasswordNotice("Abcdefg!", weak), `Choose a different password. ${passwordRulesText}`);
  assert.equal(isWeakPasswordError({ message: "Password should contain at least one character of each" }), true);
  assert.equal(weakPasswordNotice("nope", { code: "invalid_credentials", message: "Invalid login credentials" }), null);
});

test("the strength bar stays red until every rule is met", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const block = css.slice(css.indexOf(".strength span {"), css.indexOf(".segmented {"));
  assert.match(block, /background: var\(--miss\)/);
  const level3 = block.match(/\.strength\[data-level="3"\] span \{[^}]+\}/);
  const level4 = block.match(/\.strength\[data-level="4"\] span \{[^}]+\}/);
  assert.ok(level3);
  assert.equal(level3[0].includes("background"), false);
  assert.match(level4?.[0] ?? "", /background: var\(--teal\)/);
  assert.equal(passwordRulesText.startsWith("8+ characters"), true);
});

test("sign-up checks the rules before the auth call and sign-in stays generic", () => {
  const form = fs.readFileSync(path.join(root, "components/login-form.tsx"), "utf8");
  const actions = fs.readFileSync(path.join(root, "app/auth/actions.ts"), "utf8");
  const create = form.slice(form.indexOf('if (tab === "create")'), form.indexOf("await signInWithEmail"));
  assert.ok(create.indexOf("passwordProblem(password)") !== -1);
  assert.ok(create.indexOf("passwordProblem(password)") < create.indexOf("signUpWithEmail"));
  assert.match(form, /passwordRulesText/);
  assert.match(form, /role="meter"/);
  assert.match(form, /Show password/);
  assert.match(form, /Hide password/);
  assert.equal(form.includes("Wrong mail"), false);

  const signup = actions.slice(actions.indexOf("function signUpWithEmail"), actions.indexOf("function signInWithEmail"));
  assert.ok(signup.indexOf("passwordProblem(password)") < signup.indexOf("auth.signUp"));
  assert.match(signup, /weakPasswordNotice/);
  const signin = actions.slice(actions.indexOf("function signInWithEmail"), actions.indexOf("function sendPasswordReset"));
  assert.equal(signin.includes("passwordProblem"), false);
  assert.equal(signin.includes("weakPasswordNotice"), false);
  assert.match(signin, /return "invalid"/);
});
