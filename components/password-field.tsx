"use client";

import { useState } from "react";
import { passwordChecks } from "@/lib/password-rules";

export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  showRules,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  showRules: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="password-block">
      <label htmlFor={id}>Password</label>
      <div className="password-field">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        <button
          type="button"
          className="password-eye"
          aria-pressed={showPassword}
          aria-controls={id}
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword((shown) => !shown)}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {showRules ? (
        <div className="must-contain">
          <p>Must contain</p>
          <ul>
            {passwordChecks(value).map((rule) => (
              <li key={rule.label} data-met={rule.met ? "true" : "false"}>
                {rule.met ? <CheckIcon /> : <CrossIcon />}
                <span className="sr-only">{rule.met ? "Met, " : "Needed, "}</span>
                {rule.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
