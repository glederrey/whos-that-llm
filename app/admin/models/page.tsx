import Link from "next/link";
import { AddModelForm } from "@/components/add-model-form";
import { CompanyLogo } from "@/components/company-logo";
import { ModelFields } from "@/components/model-fields";
import { RosterReturnFields } from "@/components/roster-return-fields";
import { RosterSync } from "@/components/roster-sync";
import { SectionNav } from "@/components/section-nav";
import { saveModel, setModelEnabled } from "@/app/admin/actions";
import { rosterNotice } from "@/lib/admin-model";
import { loadRoster, type CategoryRow, type RosterRow } from "@/lib/admin-roster";
import { modelsReturnPath, nextRosterSort, pageOf, rosterSortOf, searchRoster, sortRoster, type RosterSort, type RosterSortColumn } from "@/lib/roster-list";
import { difficultyLabel } from "@/lib/difficulty";
import { regionLabel, sizeLabel } from "@/lib/game";
import { formatListPrice, formatPriceInput } from "@/lib/list-price";

export const dynamic = "force-dynamic";

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; q?: string; active?: string; inactive?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const notice = rosterNotice(params.notice);
  const { rows, companies, categories } = await loadRoster();
  const query = (params.q ?? "").slice(0, 100);
  const sort = rosterSortOf(params.sort, params.dir);
  const found = sortRoster(searchRoster(rows, query), sort);
  const active = pageOf(found.filter((row) => row.enabled), params.active);
  const inactive = pageOf(found.filter((row) => !row.enabled), params.inactive);

  return (
    <div className="stack">
      <SectionNav />
      <h1>Models</h1>
      <p className="muted">
        Turning a model off leaves it out of new rounds. Games already started keep the model they drew. Input and
        output are the list price in dollars per 1 million tokens. Update prices writes the current OpenRouter list
        price. Check availability turns off models OpenRouter no longer lists. Search for new models lists text models
        OpenRouter added in the last 30 days that are not already on the roster.
      </p>
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      <RosterSync />
      <details className="card roster-add">
        <summary>Add a model</summary>
        <AddModelForm categories={categories} query={query} sort={sort} activePage={active.page} inactivePage={inactive.page} />
      </details>
      <form action="/admin/models" method="get" className="roster-search">
          {sort ? (
            <>
              <input type="hidden" name="sort" value={sort.column} />
              <input type="hidden" name="dir" value={sort.dir} />
            </>
          ) : null}
          <input type="search" name="q" defaultValue={query} placeholder="Search by name, company, or category" aria-label="Search models" />
        <button className="button" type="submit">
          Search
        </button>
        {query ? (
          <Link className="button-quiet" href={modelsHref({ query: "", activePage: 1, inactivePage: 1, sort })}>
            Reset
          </Link>
        ) : null}
      </form>
      <RosterSection title="Active models" empty="No active models." list={active} query={query} pageKey="active" otherPage={inactive.page} sort={sort} categories={categories} />
      <RosterSection title="Inactive models" empty="No inactive models." list={inactive} query={query} pageKey="inactive" otherPage={active.page} sort={sort} categories={categories} />
      <datalist id="roster-companies">
        {companies.map((company) => (
          <option key={company.id} value={company.name} />
        ))}
      </datalist>
    </div>
  );
}

type RosterPage = { rows: RosterRow[]; page: number; pageCount: number };

const sortLabels: Record<RosterSortColumn, string> = {
  name: "Name",
  company: "Company",
  region: "Region",
  year: "Year",
  size: "Size",
  difficulty: "Difficulty",
  input: "Input",
  output: "Output",
  categories: "Categories",
};

function modelsHref(state: { query: string; activePage: number; inactivePage: number; sort: RosterSort }) {
  return modelsReturnPath({
    q: state.query,
    sort: state.sort?.column,
    dir: state.sort?.dir,
    active: state.activePage > 1 ? String(state.activePage) : "",
    inactive: state.inactivePage > 1 ? String(state.inactivePage) : "",
  });
}

function RosterSection({
  title,
  empty,
  list,
  query,
  pageKey,
  otherPage,
  sort,
  categories,
}: {
  title: string;
  empty: string;
  list: RosterPage;
  query: string;
  pageKey: "active" | "inactive";
  otherPage: number;
  sort: RosterSort;
  categories: CategoryRow[];
}) {
  const hrefFor = (page: number) =>
    modelsHref({
      query,
      sort,
      activePage: pageKey === "active" ? page : otherPage,
      inactivePage: pageKey === "inactive" ? page : otherPage,
    });
  const sortHref = (column: RosterSortColumn) =>
    modelsHref({
      query,
      activePage: 1,
      inactivePage: 1,
      sort: nextRosterSort(sort, column),
    });
  return (
    <section className="stack">
      <h2>{title}</h2>
      {list.rows.length === 0 ? (
        <div className="card empty">{query ? "No models match that search." : empty}</div>
      ) : (
        <>
          <div className="card roster-card">
            <table className="roster models">
              <thead>
                <tr>
                  {(Object.keys(sortLabels) as RosterSortColumn[]).map((column) => {
                    const active = sort?.column === column;
                    return (
                      <th key={column} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <Link href={sortHref(column)} scroll={false}>
                          {sortLabels[column]}
                          {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                        </Link>
                      </th>
                    );
                  })}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => (
                  <ModelRow
                    key={row.id}
                    row={row}
                    categories={categories}
                    query={query}
                    sort={sort}
                    activePage={pageKey === "active" ? list.page : otherPage}
                    inactivePage={pageKey === "inactive" ? list.page : otherPage}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="row pager">
            <div className="row">
              {list.page > 1 ? (
                <Link className="button-quiet" href={hrefFor(list.page - 1)} scroll={false}>
                  Previous
                </Link>
              ) : (
                <span className="button-quiet is-disabled">Previous</span>
              )}
              <span className="muted">
                Page {list.page} of {list.pageCount}
              </span>
              {list.page < list.pageCount ? (
                <Link className="button-quiet" href={hrefFor(list.page + 1)} scroll={false}>
                  Next
                </Link>
              ) : (
                <span className="button-quiet is-disabled">Next</span>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ModelRow({
  row,
  categories,
  query,
  sort,
  activePage,
  inactivePage,
}: {
  row: RosterRow;
  categories: CategoryRow[];
  query: string;
  sort: RosterSort;
  activePage: number;
  inactivePage: number;
}) {
  const panel = `edit-${row.id}`;
  return (
    <tr className={row.enabled ? undefined : "is-off"}>
      <td>{row.name}</td>
      <td>
        <span className="roster-company">
          <CompanyLogo src={row.logoUrl} />
          <span>{row.companyName}</span>
        </span>
      </td>
      <td>{regionLabel(row.region)}</td>
      <td>{row.year || "—"}</td>
      <td>{sizeLabel(row.size)}</td>
      <td>{row.difficulty ? difficultyLabel[row.difficulty] : "—"}</td>
      <td>{formatListPrice(row.inputUsdPerMtok)}</td>
      <td>{formatListPrice(row.outputUsdPerMtok)}</td>
      <td>{row.categoryNames || "—"}</td>
      <td>
        <div className="roster-buttons">
          <form action={setModelEnabled}>
            <RosterReturnFields query={query} sort={sort} activePage={activePage} inactivePage={inactivePage} />
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="enabled" value={row.enabled ? "0" : "1"} />
            <button className={row.enabled ? "button-off" : "button-on"} type="submit">
              {row.enabled ? "Off" : "On"}
            </button>
          </form>
          <button className="button-quiet" type="button" popoverTarget={panel}>
            Edit
          </button>
        </div>
        <div id={panel} popover="auto" className="roster-edit card">
          <form action={saveModel} className="stack">
            <h2>Edit {row.name}</h2>
            <RosterReturnFields query={query} sort={sort} activePage={activePage} inactivePage={inactivePage} />
            <input type="hidden" name="id" value={row.id} />
            <div className="roster-form">
              <ModelFields
                openrouterId={row.openrouterId}
                name={row.name}
                company={row.companyName}
                region={row.region}
                year={row.year}
                size={row.size}
                difficulty={row.difficulty ?? ""}
                inputPrice={formatPriceInput(row.inputUsdPerMtok)}
                outputPrice={formatPriceInput(row.outputUsdPerMtok)}
                categories={categories}
                categoryIds={row.categoryIds}
              />
            </div>
            <p className="muted">Prices are dollars per 1 million tokens. Region belongs to the company. New games use it.</p>
            <div className="row">
              <button className="button" type="submit">
                Save
              </button>
              <button className="button-quiet" type="button" popoverTarget={panel} popoverTargetAction="hide">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}
