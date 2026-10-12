import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { isWeakPasswordError, passwordChecks, passwordProblem, passwordRulesText, passwordStrength, weakPasswordNotice } from "./password-rules";

const root = path.resolve(import.meta.dirname, "..");

test("a short password names the missing length", () => {
  assert.equal(passwordProblem("Abcd1!"), "Password needs at least 8 characters.");
  assert.equal(passwordStrength("Abcd1!"), 4);
});

test("a password without a digit names the digit", () => {
  assert.equal(passwordProblem("Abcdefg!"), "Password needs a digit.");
  assert.equal(passwordStrength("Abcdefg!"), 4);
  assert.deepEqual(
    passwordChecks("Abcdefg!").map((rule) => [rule.label, rule.met]),
    [
      ["8+ characters", true],
      ["A lowercase letter", true],
      ["An uppercase letter", true],
      ["A digit", false],
      ["A symbol", true],
    ],
  );
});

test("a password without a symbol names the symbol", () => {
  assert.equal(passwordProblem("Abcdefg1"), "Password needs a symbol.");
  assert.equal(passwordStrength("Abcdefg1"), 4);
});

test("a password that meets every rule is accepted", () => {
  assert.equal(passwordProblem("Abcdef1!"), null);
  assert.equal(passwordStrength("Abcdef1!"), 5);
});

test("several missing rules are listed together", () => {
  assert.equal(passwordProblem("abcdefg"), "Password needs at least 8 characters, an uppercase letter, a digit, and a symbol.");
  assert.equal(passwordProblem(""), "Password needs at least 8 characters, a lowercase letter, an uppercase letter, a digit, and a symbol.");
});

test("a weak-password response uses the same missing-rule message", () => {
  const weak = { code: "weak_password", name: "AuthWeakPasswordError", message: "Password is known to be weak" };
  assert.equal(weakPasswordNotice("Abcdefg!", weak), "Password needs a digit.");
  assert.equal(weakPasswordNotice("Abcdefg1", weak), "Password needs a symbol.");
  assert.equal(weakPasswordNotice("Abcdef1!", weak), `Choose a different password. ${passwordRulesText}`);
  assert.equal(isWeakPasswordError({ message: "Password should contain at least one character of each" }), true);
  assert.equal(weakPasswordNotice("nope", { code: "invalid_credentials", message: "Invalid login credentials" }), null);
});

test("a met rule turns green and an unmet rule stays grey", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const block = css.slice(css.indexOf(".must-contain {"), css.indexOf(".sr-only"));
  assert.match(block, /\.must-contain li \{[^}]*color: var\(--mute\)/);
  assert.match(block, /\.must-contain li\[data-met="true"\] \{ color: #1c7c43; \}/);
  assert.equal(css.includes(".strength"), false);
  assert.equal(passwordRulesText, "8+ characters, a lowercase letter, an uppercase letter, a digit, and a symbol.");
});

test("sign-up checks the rules before the auth call and sign-in stays generic", () => {
  const form = fs.readFileSync(path.join(root, "components/login-form.tsx"), "utf8");
  const actions = fs.readFileSync(path.join(root, "app/auth/actions.ts"), "utf8");
  const create = form.slice(form.indexOf('if (tab === "create")'), form.indexOf("await signInWithEmail"));
  assert.ok(create.indexOf("passwordProblem(password)") !== -1);
  assert.ok(create.indexOf("passwordProblem(password)") < create.indexOf("signUpWithEmail"));
  const tabs = form.slice(form.indexOf("function showTab"), form.indexOf("function noticeError"));
  assert.match(tabs, /setError\(""\)/);
  assert.match(tabs, /setNote\(""\)/);
  assert.match(form, /showTab\("sign-in"\)/);
  assert.match(form, /showTab\("create"\)/);
  assert.match(form, /Must contain/);
  assert.match(form, /passwordChecks\(password\)/);
  assert.equal(form.includes("passwordRulesText"), false);
  assert.equal(form.includes('role="meter"'), false);
  assert.match(form, /data-met=\{rule\.met \? "true" : "false"\}/);
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
