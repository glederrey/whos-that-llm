const checks = [
  { label: "At least 8 characters", missing: "at least 8 characters", met: (password: string) => password.length >= 8 },
  { label: "A lowercase letter", missing: "a lowercase letter", met: (password: string) => /[a-z]/.test(password) },
  { label: "An uppercase letter", missing: "an uppercase letter", met: (password: string) => /[A-Z]/.test(password) },
  { label: "A digit", missing: "a digit", met: (password: string) => /\d/.test(password) },
  { label: "A symbol", missing: "a symbol", met: (password: string) => /[^A-Za-z0-9]/.test(password) },
] as const;

export function passwordChecks(password: string): { label: string; met: boolean }[] {
  return checks.map((check) => ({ label: check.label, met: check.met(password) }));
}

export const passwordRulesText = "At least 8 characters, a lowercase letter, an uppercase letter, a digit, and a symbol.";

export function passwordStrength(password: string): number {
  return checks.reduce((count, check) => count + (check.met(password) ? 1 : 0), 0);
}

export function passwordProblem(password: string): string | null {
  const missing = checks.filter((check) => !check.met(password)).map((check) => check.missing);
  if (missing.length === 0) return null;
  if (missing.length === 1) return `Password needs ${missing[0]}.`;
  const last = missing[missing.length - 1];
  const rest = missing.slice(0, -1).join(", ");
  const comma = missing.length > 2 ? "," : "";
  return `Password needs ${rest}${comma} and ${last}.`;
}

export function isWeakPasswordError(error: { message?: string; code?: string; name?: string }): boolean {
  if (error.code === "weak_password" || error.name === "AuthWeakPasswordError") return true;
  const text = (error.message ?? "").toLowerCase();
  return text.includes("password") && (text.includes("weak") || text.includes("should be at least") || text.includes("should contain"));
}

export function weakPasswordNotice(password: string, error: { message?: string; code?: string; name?: string }): string | null {
  if (!isWeakPasswordError(error)) return null;
  return passwordProblem(password) ?? `Choose a different password. ${passwordRulesText}`;
}
