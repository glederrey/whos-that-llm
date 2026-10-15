import { ProviderTable } from "@/components/provider-table";
import { SectionNav } from "@/components/section-nav";
import { requireOwner } from "@/lib/admin-access";
import { loadProviderRecords, type ProviderRecord } from "@/lib/openrouter-providers";

export const dynamic = "force-dynamic";

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;
  let rows: ProviderRecord[] = [];
  let failed = false;
  try {
    rows = await loadProviderRecords();
  } catch {
    failed = true;
  }
  const blacklisted = rows.filter((row) => row.blacklisted);
  const trusted = rows.filter((row) => !row.blacklisted);

  return (
    <div className="stack providers-page">
      <SectionNav />
      <h1>OpenRouter providers</h1>
      <p className="muted">
        A reasoning reply from a provider we have not seen is held, counted, then stored here. Trusted providers stream
        on the next call. A provider that reports reasoning tokens is trusted. A provider that reports none is
        blacklisted when the output, with reasoning removed, is more than 20% above the gpt-tokenizer count and more
        than 16 tokens above it. Output in this table is that same count. Deblacklist puts a provider back on trial.
      </p>
      {failed ? (
        <p className="error" role="alert">
          Could not read providers. Apply supabase/migrations/0032_openrouter_providers.sql, then reload.
        </p>
      ) : null}
      {params.notice === "save" ? (
        <p className="error" role="alert">
          Could not clear that provider.
        </p>
      ) : null}
      <h2>Blacklisted</h2>
      <ProviderTable rows={blacklisted} empty="No provider is blacklisted." blacklisted />
      <h2>Trusted</h2>
      <ProviderTable rows={trusted} empty="No provider has passed the check yet." blacklisted={false} />
    </div>
  );
}
