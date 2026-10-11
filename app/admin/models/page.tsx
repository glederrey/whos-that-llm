import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import { SectionNav } from "@/components/section-nav";
import { addModel, saveModel, setModelEnabled } from "@/app/admin/actions";
import { rosterNotice } from "@/lib/admin-model";
import { loadRoster, type ClassRow, type RosterRow } from "@/lib/admin-roster";
import { pageOf, searchRoster } from "@/lib/roster-list";
import { regionLabel, sizeLabel } from "@/lib/game";
import { formatListPrice } from "@/lib/list-price";

export const dynamic = "force-dynamic";

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; q?: string; active?: string; inactive?: string }>;
}) {
  const params = await searchParams;
  const notice = rosterNotice(params.notice);
  const { rows, companies, classes } = await loadRoster();
  const query = (params.q ?? "").slice(0, 100);
  const found = searchRoster(rows, query);
  const active = pageOf(found.filter((row) => row.enabled), params.active);
  const inactive = pageOf(found.filter((row) => !row.enabled), params.inactive);

  return (
    <div className="stack">
      <SectionNav />
      <h1>Models</h1>
      <p className="muted">
        Turning a model off leaves it out of new rounds. Games already started keep the model they drew. Input and
        output are the list price in dollars per 1 million tokens.
      </p>
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      <details className="card roster-add">
        <summary>Add a model</summary>
        <form action={addModel} className="stack">
          <div className="roster-form">
            <ModelFields classes={classes} />
          </div>
          <p className="muted">A new model stays off until you turn it on. A new company name is added to the list.</p>
          <div>
            <button className="button" type="submit">
              Add model
            </button>
          </div>
        </form>
      </details>
      <form action="/admin/models" method="get" className="roster-search">
          <input type="search" name="q" defaultValue={query} placeholder="Search by name, company, or class" aria-label="Search models" />
        <button className="button" type="submit">
          Search
        </button>
        {query ? (
          <Link className="button-quiet" href="/admin/models">
            Clear
          </Link>
        ) : null}
      </form>
      <RosterSection title="Active models" empty="No active models." list={active} query={query} pageKey="active" otherPage={inactive.page} classes={classes} />
      <RosterSection title="Inactive models" empty="No inactive models." list={inactive} query={query} pageKey="inactive" otherPage={active.page} classes={classes} />
      <datalist id="roster-companies">
        {companies.map((company) => (
          <option key={company.id} value={company.name} />
        ))}
      </datalist>
    </div>
  );
}

type RosterPage = { rows: RosterRow[]; page: number; pageCount: number };

function modelsHref(query: string, activePage: number, inactivePage: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (activePage > 1) params.set("active", String(activePage));
  if (inactivePage > 1) params.set("inactive", String(inactivePage));
  const text = params.toString();
  return text ? `/admin/models?${text}` : "/admin/models";
}

function RosterSection({
  title,
  empty,
  list,
  query,
  pageKey,
  otherPage,
  classes,
}: {
  title: string;
  empty: string;
  list: RosterPage;
  query: string;
  pageKey: "active" | "inactive";
  otherPage: number;
  classes: ClassRow[];
}) {
  const hrefFor = (page: number) =>
    pageKey === "active" ? modelsHref(query, page, otherPage) : modelsHref(query, otherPage, page);
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
                  <th>Name</th>
                  <th>Company</th>
                  <th>Region</th>
                  <th>Year</th>
                  <th>Size</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Classes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => (
                  <ModelRow key={row.id} row={row} classes={classes} />
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

function ModelRow({ row, classes }: { row: RosterRow; classes: ClassRow[] }) {
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
      <td>{formatListPrice(row.inputUsdPerMtok)}</td>
      <td>{formatListPrice(row.outputUsdPerMtok)}</td>
      <td>{row.classNames || "—"}</td>
      <td>
        <div className="roster-buttons">
          <form action={setModelEnabled}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="enabled" value={row.enabled ? "0" : "1"} />
            <button className={row.enabled ? "button-off" : "button-on"} type="submit">
              {row.enabled ? "Turn off" : "Turn on"}
            </button>
          </form>
          <button className="button-quiet" type="button" popoverTarget={panel}>
            Edit
          </button>
        </div>
        <div id={panel} popover="auto" className="roster-edit card">
          <form action={saveModel} className="stack">
            <h2>Edit {row.name}</h2>
            <input type="hidden" name="id" value={row.id} />
            <div className="roster-form">
              <ModelFields
                openrouterId={row.openrouterId}
                name={row.name}
                company={row.companyName}
                region={row.region}
                year={row.year}
                size={row.size}
                classes={classes}
                classIds={row.classIds}
              />
            </div>
            <p className="muted">Region belongs to the company. New games use it.</p>
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

function ModelFields({
  openrouterId = "",
  name = "",
  company = "",
  region = "us",
  year = "",
  size = "small",
  classes = [],
  classIds = [],
}: {
  openrouterId?: string;
  name?: string;
  company?: string;
  region?: string;
  year?: string;
  size?: string;
  classes?: ClassRow[];
  classIds?: string[];
}) {
  return (
    <>
      <label>
        OpenRouter id
        <input name="openrouterId" defaultValue={openrouterId} placeholder="openai/gpt-5.6-luna" required />
      </label>
      <label>
        Display name
        <input name="name" defaultValue={name} required />
      </label>
      <label>
        Company
        <input name="company" defaultValue={company} list="roster-companies" required />
      </label>
      <label>
        Region
        <select name="region" defaultValue={region} required>
          <option value="us">USA</option>
          <option value="cn">China</option>
          <option value="eu">Europe</option>
        </select>
      </label>
      <label>
        Year
        <input name="year" defaultValue={year} inputMode="numeric" required />
      </label>
      <label>
        Size
        <select name="size" defaultValue={size} required>
          <option value="nano">Nano</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="xxl">XXL</option>
        </select>
      </label>
      <fieldset className="class-picks">
        <legend>Classes</legend>
        {classes.length === 0 ? (
          <p className="muted">
            No classes yet. <a href="/admin/classes">Create one</a> before attaching it here.
          </p>
        ) : (
          classes.map((item) => (
            <label key={item.id}>
              <input type="checkbox" name="classId" value={item.id} defaultChecked={classIds.includes(item.id)} />
              {item.name}
            </label>
          ))
        )}
      </fieldset>
    </>
  );
}
