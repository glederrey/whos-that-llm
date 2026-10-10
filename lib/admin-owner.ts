import "server-only";

export function adminEmail(): string {
  return process.env.ADMIN_EMAIL ?? "";
}
