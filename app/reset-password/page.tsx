import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPassword } from "@/components/reset-password";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash: tokenHash } = await searchParams;
  if (!tokenHash) redirect("/login");
  return <ResetPassword tokenHash={tokenHash} />;
}
