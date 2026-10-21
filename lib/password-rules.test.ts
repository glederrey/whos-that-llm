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
      ["At least 8 characters", true],
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

test("an accented letter is not a symbol", () => {
  assert.equal(passwordProblem("asdasd98Là"), "Password needs a symbol.");
  assert.equal(passwordChecks("asdasd98Là").find((rule) => rule.label === "A symbol")?.met, false);
  assert.equal(passwordProblem("Abcdef1à"), "Password needs a symbol.");
  assert.equal(passwordProblem("Abcdef1 "), "Password needs a symbol.");
  assert.equal(passwordProblem("asdasd98L!"), null);
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
  assert.match(block, /\.must-contain li\[data-met="true"\] \{ color: #0b6b2e; font-family: var\(--font-bold\), var\(--font\), "Segoe UI", sans-serif; font-weight: 700; \}/);
  assert.match(block, /html\[data-theme="dark"\] \.must-contain li\[data-met="true"\] \{ color: #4cce7a; font-family: var\(--font-bold\), var\(--font\), "Segoe UI", sans-serif; font-weight: 700; \}/);
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  assert.match(layout, /roboto-latin-700\.woff2/);
  assert.match(layout, /variable: "--font-bold"/);
  const container = block.match(/\.must-contain \{[^}]*\}/)?.[0] ?? "";
  assert.equal(container.includes("padding-left"), false);
  assert.match(block, /\.must-contain ul \{[^}]*padding-left: 16px[^}]*grid-template-columns: 1fr 1fr/);
  assert.match(block, /\.must-contain li:nth-child\(3\) \{ grid-column: 2; grid-row: 1 \/ 3; align-self: center; \}/);
  assert.match(block, /\.must-contain li:nth-child\(5\) \{ grid-column: 2; grid-row: 2 \/ 4; align-self: center; \}/);
  assert.match(block, /@media \(max-width: 560px\) \{\s*\.must-contain ul \{ padding-left: 0; \}/);
  assert.equal(css.includes(".strength"), false);
  assert.equal(passwordRulesText, "At least 8 characters, a lowercase letter, an uppercase letter, a digit, and a symbol.");
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
  assert.ok(form.indexOf('className="auth-confirm"') > form.indexOf('type="submit"'));
  assert.match(form, /setNote\("The confirmation email has been sent\."\)/);
  assert.equal(form.includes("Supabase will email you a confirmation link. Check your email."), false);
  assert.match(form, /signingIn \|\| confirmationSent \? null : <p className="auth-confirm">Supabase will email you a confirmation link\.<\/p>/);
  assert.match(form, /An account with this email already exists\./);
  assert.equal(form.includes("That email is already registered."), false);
  assert.match(form, /<p className="error auth-error">\{error\}<\/p>/);
  assert.match(form, /<p className="muted auth-note">\{note\}<\/p>/);
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.auth-confirm \{ color: var\(--mute\); font-size: 14px; font-weight: 500; text-align: center; \}/);
  assert.match(css, /\.auth-error \{ text-align: center; \}/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.page:has\(\.auth-screen\) \{ flex: 1 0 auto; display: flex; flex-direction: column; padding-top: 0; padding-bottom: 12px; \}/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.auth-screen \{ margin-top: auto; margin-bottom: auto; \}/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.page:has\(\.auth-screen\) \+ \.footer \{ margin-top: 0; \}/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.footer-inner \{[^}]*align-items: center;[^}]*text-align: center;/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.credit \{ justify-content: center; \}/);
  assert.match(form, /className="auth auth-screen"/);
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
  assert.match(signup, /signUpFailureNotice\(error\)/);
  assert.ok(signup.indexOf("weakPasswordNotice") < signup.indexOf("signUpFailureNotice"));
  const signin = actions.slice(actions.indexOf("function signInWithEmail"), actions.indexOf("function sendPasswordReset"));
  assert.equal(signin.includes("passwordProblem"), false);
  assert.equal(signin.includes("weakPasswordNotice"), false);
  assert.equal(signin.includes("signUpFailureNotice"), false);
  assert.match(signin, /return "invalid"/);
});
