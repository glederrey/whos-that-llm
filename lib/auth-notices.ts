export type SignUpFailure = "invalid" | "exists" | "confirm" | "rate";

// A repeated sign-up for an unconfirmed email does not say the address is taken.
// Supabase tries to send the confirmation again. Inside the per-address window
// that resend is "For security purposes, you can only request this after N seconds."
// The project-wide cap is "email rate limit exceeded", and that one rolls back a new user.
export function signUpFailureNotice(error: { message?: string; code?: string }): SignUpFailure {
  const code = error.code ?? "";
  const text = (error.message ?? "").toLowerCase();
  if (code === "email_exists" || code === "user_already_exists" || text.includes("already")) return "exists";
  const resendTooSoon = text.includes("only request this") || text.includes("security purposes");
  if (code === "over_email_send_rate_limit" || text.includes("rate limit") || resendTooSoon) {
    return resendTooSoon ? "exists" : "rate";
  }
  if (text.includes("confirm")) return "confirm";
  return "invalid";
}

export type ChangePasswordResult = "auth" | "invalid" | "same" | { rules: string } | null;

export function changePasswordNotice(result: ChangePasswordResult): string {
  if (result === null) return "";
  if (typeof result === "object") return result.rules;
  if (result === "invalid") return "The current password is not right.";
  if (result === "same") return "Choose a password different from the current one.";
  return "Could not change the password. Try again.";
}
