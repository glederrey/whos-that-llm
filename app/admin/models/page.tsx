import { RosterBrowser } from "@/components/roster-browser";
import { RosterSync } from "@/components/roster-sync";
import { SectionNav } from "@/components/section-nav";
import { rosterNotice } from "@/lib/admin-model";
import { loadRoster, type RosterRow } from "@/lib/admin-roster";
import { pageOf, rosterSortOf, searchRoster, sortRoster } from "@/lib/roster-list";

export const dynamic = "force-dynamic";

/** Changes when a saved model changes, so the browser list is replaced by the database roster. */
function rosterStamp(rows: RosterRow[]): string {
  return rows
    .map((row) =>
      [
        row.id,
        row.enabled ? "1" : "0",
        row.available ? "1" : "0",
        row.name,
        row.openrouterId,
        row.companyName,
        row.region,
        row.year,
        row.size,
        row.difficulty ?? "",
        row.inputUsdPerMtok ?? "",
        row.outputUsdPerMtok ?? "",
        row.logoUrl,
        row.categoryIds.join("."),
      ].join("\t"),
    )
    .join("\n");
}

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; q?: string; active?: string; inactive?: string; unavailable?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const notice = rosterNotice(params.notice);
  const { rows, companies, categories } = await loadRoster();
  const query = (params.q ?? "").slice(0, 100);
  const sort = rosterSortOf(params.sort, params.dir);
  const found = sortRoster(searchRoster(rows, query), sort);
  const active = pageOf(found.filter((row) => row.available && row.enabled), params.active);
  const inactive = pageOf(found.filter((row) => row.available && !row.enabled), params.inactive);
  const unavailable = pageOf(found.filter((row) => !row.available), params.unavailable);

  return (
    <div className="stack">
      <SectionNav />
      <h1>Models</h1>
      <p className="muted">
        Turning a model off leaves it out of new rounds. Games already started keep the model they drew. Input and
        output are the list price in dollars per 1 million tokens. Update prices writes the current OpenRouter list
        price. Check availability moves models OpenRouter no longer lists into Unavailable on OpenRouter. Those stay in
        the database and cannot be turned on. Search for new models lists text models OpenRouter added in the last 30
        days that are not already on the roster.
      </p>
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      <RosterSync />
      <RosterBrowser
        key={rosterStamp(rows)}
        rows={rows}
        categories={categories}
        initialQuery={query}
        initialSort={sort}
        initialActive={active.page}
        initialInactive={inactive.page}
        initialUnavailable={unavailable.page}
      />
      <datalist id="roster-companies">
        {companies.map((company) => (
          <option key={company.id} value={company.name} />
        ))}
      </datalist>
    </div>
  );
}
