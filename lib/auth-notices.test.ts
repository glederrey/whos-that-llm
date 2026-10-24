import assert from "node:assert/strict";
import test from "node:test";
import { changePasswordNotice, signUpFailureNotice } from "./auth-notices";

test("an existing email is not a wrong password", () => {
  assert.equal(signUpFailureNotice({ message: "User already registered", code: "user_already_exists" }), "exists");
  assert.equal(signUpFailureNotice({ message: "Email exists", code: "email_exists" }), "exists");
  assert.equal(
    signUpFailureNotice({
      message: "For security purposes, you can only request this after 45 seconds.",
      code: "over_email_send_rate_limit",
    }),
    "exists",
  );
});

test("a project email cap is not a wrong password and does not claim the account exists", () => {
  assert.equal(signUpFailureNotice({ message: "email rate limit exceeded", code: "over_email_send_rate_limit" }), "rate");
});

test("sign-up still tells an unconfirmed address to confirm, and leaves other failures invalid", () => {
  assert.equal(signUpFailureNotice({ message: "Email not confirmed", code: "email_not_confirmed" }), "confirm");
  assert.equal(signUpFailureNotice({ message: "Invalid login credentials", code: "invalid_credentials" }), "invalid");
});

test("the change password notices name what went wrong", () => {
  assert.equal(changePasswordNotice(null), "");
  assert.equal(changePasswordNotice({ rules: "Password needs a digit." }), "Password needs a digit.");
  assert.match(changePasswordNotice("invalid"), /current password is not right/);
  assert.match(changePasswordNotice("same"), /different/);
  assert.match(changePasswordNotice("auth"), /Could not change/);
});
