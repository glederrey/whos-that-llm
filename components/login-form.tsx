"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordReset, signInWithEmail, signUpWithEmail, startGoogleSignIn, type AuthNotice } from "@/app/auth/actions";
import { passwordChecks, passwordProblem } from "@/lib/password-rules";
import { safeNext } from "@/lib/paths";

export function LoginForm({
  next,
  cancelled,
  startOnCreate,
}: {
  next: string;
  cancelled: boolean;
  startOnCreate: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"sign-in" | "create">(startOnCreate ? "create" : "sign-in");
  const [storedOpen, setStoredOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(cancelled ? "Google sign-in was cancelled." : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  function showTab(next: "sign-in" | "create") {
    setTab(next);
    setError("");
    setNote("");
  }

  function noticeError(notice: AuthNotice | "rate") {
    if (notice === "exists") return "An account with this email already exists.";
    if (notice === "confirm") return "Confirm your email, then come back.";
    if (notice === "rate") return "The confirmation email could not be sent. Try again in a minute.";
    return "Wrong email or password.";
  }

  async function google() {
    setBusy(true);
    setError("");
    const result = await startGoogleSignIn();
    if ("url" in result) {
      window.location.assign(result.url);
      return;
    }
    setError("Google sign-in was cancelled.");
    setBusy(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    if (tab === "create") {
      const problem = passwordProblem(password);
      if (problem) {
        setBusy(false);
        setError(problem);
        return;
      }
      const result = await signUpWithEmail(email, password);
      setBusy(false);
      if (result === "confirm") {
        setNote("The confirmation email has been sent.");
        return;
      }
      if (result && typeof result === "object") {
        setError(result.rules);
        return;
      }
      if (result) {
        setError(noticeError(result));
        return;
      }
      router.push(safeNext(next));
      router.refresh();
      return;
    }
    const result = await signInWithEmail(email, password);
    setBusy(false);
    if (result) {
      setError(noticeError(result));
      return;
    }
    router.push(safeNext(next));
    router.refresh();
  }

  function openForgot() {
    setError("");
    setNote("");
    setForgotOpen(true);
  }

  function closeForgot() {
    setError("");
    setNote("");
    setForgotOpen(false);
  }

  async function requestReset(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    await sendPasswordReset(email);
    setBusy(false);
    setNote("Check your email.");
  }

  const signingIn = tab === "sign-in";
  const confirmationSent = note === "The confirmation email has been sent.";

  if (forgotOpen) {
    return (
      <div className="auth auth-screen">
        <h1>Reset your password</h1>
        <p className="muted">Enter your email and we will send you a link to choose a new password.</p>
        <form className="stack" onSubmit={requestReset}>
          <label>
            Email
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button type="submit" className="button" disabled={busy}>
            Send request to change password
          </button>
        </form>
        {note ? <p className="muted">{note}</p> : null}
        <button type="button" className="text-link forgot" onClick={closeForgot}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="auth auth-screen">
      <h1>{signingIn ? "Sign in" : "Create account"}</h1>
      <div className="segmented" role="group" aria-label="Sign in or create an account">
        <button type="button" aria-pressed={signingIn} onClick={() => showTab("sign-in")}>
          Sign in
        </button>
        <button type="button" aria-pressed={!signingIn} onClick={() => showTab("create")}>
          Create account
        </button>
      </div>
      <button type="button" className="button-quiet button-google" onClick={google} disabled={busy}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81Z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.43-3.43C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1C6.22 6.87 8.87 4.76 12 4.76Z" />
        </svg>
        Continue with Google
      </button>
      <p className="or">or</p>
      <form className="stack" onSubmit={submit}>
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <div className="password-block">
          <label htmlFor="account-password">Password</label>
          <div className="password-field">
            <input
              id="account-password"
              type={showPassword ? "text" : "password"}
              autoComplete={signingIn ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="password-eye"
              aria-pressed={showPassword}
              aria-controls="account-password"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {signingIn ? null : (
            <div className="must-contain">
              <p>Must contain</p>
              <ul>
                {passwordChecks(password).map((rule) => (
                  <li key={rule.label} data-met={rule.met ? "true" : "false"}>
                    {rule.met ? <CheckIcon /> : <CrossIcon />}
                    <span className="sr-only">{rule.met ? "Met, " : "Needed, "}</span>
                    {rule.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {signingIn ? (
          <button type="button" className="text-link forgot" onClick={openForgot} disabled={busy}>
            Forgot password
          </button>
        ) : (
          <div>
            <button
              type="button"
              className="disclose"
              aria-expanded={storedOpen}
              onClick={() => setStoredOpen((open) => !open)}
            >
              What we store
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {storedOpen ? (
              <div className="disclose-panel">
                <p>
                  We keep your username and your games. A game is the messages you send, the replies you receive, and the
                  guesses you make. They are kept for research. The developer is a data scientist and studies how people
                  question a hidden model.
                </p>
                <p>
                  Nothing else is kept. The email address is not saved with the game. Sign-in goes through Supabase, which
                  uses it only to confirm the account and to keep automated sign-ups out.
                </p>
              </div>
            ) : null}
          </div>
        )}
        <button type="submit" className="button" disabled={busy}>
          {signingIn ? "Sign in" : "Create account"}
        </button>
        {signingIn || confirmationSent ? null : <p className="auth-confirm">Supabase will email you a confirmation link.</p>}
      </form>
      {note ? <p className="muted">{note}</p> : null}
      {error ? <p className={signingIn ? "error" : "error auth-error"}>{error}</p> : null}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L20 7" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10.5 10.7a3 3 0 0 0 4.2 4.2" />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4.1" />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6.1 6.1C3.6 7.9 2 12 2 12a18 18 0 0 0 6.2 5.7 10.6 10.6 0 0 0 5.1 1.1" />
    </svg>
  );
}
