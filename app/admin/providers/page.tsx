import { clearProvider } from "@/app/admin/actions";
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
    <div className="stack">
      <SectionNav />
      <h1>OpenRouter providers</h1>
      <p className="muted">
        A reasoning reply from a provider we have not seen is held, counted, then stored here. Trusted providers stream
        on the next call. A provider whose visible output is more than 10% above the gpt-tokenizer count, and more
        than 16 tokens above it, is blacklisted
        and skipped. Deblacklist puts it back on trial.
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

function ProviderTable({ rows, empty, blacklisted }: { rows: ProviderRecord[]; empty: string; blacklisted: boolean }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="card roster-card">
      <table className="roster compact providers">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Model</th>
            <th>Updated</th>
            <th>Input</th>
            <th>Output</th>
            <th>Reasoning</th>
            <th>Cached</th>
            <th>gpt-tokenizer</th>
            <th>Log</th>
            {blacklisted ? <th></th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug}>
              <td>{row.slug}</td>
              <td>{row.model ?? "—"}</td>
              <td>{formatWhen(row.updatedAt)}</td>
              <td>{count(row.inputTokens)}</td>
              <td>{count(row.outputTokens)}</td>
              <td>{count(row.reasoningTokens)}</td>
              <td>{count(row.cachedTokens)}</td>
              <td>{count(row.gptTokens)}</td>
              <td>{row.reason ? <Log reason={row.reason} /> : "—"}</td>
              {blacklisted ? (
                <td>
                  <form action={clearProvider}>
                    <input type="hidden" name="slug" value={row.slug} />
                    <button type="submit" className="button-quiet">
                      Deblacklist
                    </button>
                  </form>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Log({ reason }: { reason: string }) {
  return (
    <details>
      <summary>Why</summary>
      <pre className="provider-reason">{reason}</pre>
    </details>
  );
}

function count(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}
