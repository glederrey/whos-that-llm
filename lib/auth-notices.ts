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
