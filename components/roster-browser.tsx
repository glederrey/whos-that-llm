"use client";

import { useState } from "react";
import { saveModel, setModelEnabled } from "@/app/admin/actions";
import { CompanyLogo } from "@/components/company-logo";
import { ModelFields } from "@/components/model-fields";
import { SaveButton } from "@/components/save-button";
import { RosterReturnFields } from "@/components/roster-return-fields";
import { AddModelForm } from "@/components/add-model-form";
import type { CompanyOption } from "@/lib/admin-company";
import { difficultyLabel } from "@/lib/difficulty";
import { originLabel, sizeLabel } from "@/lib/game";
import { formatListPrice } from "@/lib/list-price";
import type { CategoryRow, RosterRow } from "@/lib/roster-row";
import { nextRosterSort, pageOf, searchRoster, sortRoster, type RosterSort, type RosterSortColumn } from "@/lib/roster-list";

const sortLabels: Record<RosterSortColumn, string> = {
  name: "Name",
  company: "Company",
  origin: "Origin",
  year: "Year",
  size: "Size",
  difficulty: "Difficulty",
  input: "Input",
  output: "Output",
  categories: "Categories",
};

export function RosterBrowser({
  rows,
  categories,
  companies,
  initialQuery,
  initialSort,
  initialActive,
  initialInactive,
  initialUnavailable,
}: {
  rows: RosterRow[];
  categories: CategoryRow[];
  companies: CompanyOption[];
  initialQuery: string;
  initialSort: RosterSort;
  initialActive: number;
  initialInactive: number;
  initialUnavailable: number;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<RosterSort>(initialSort);
  const [activePage, setActivePage] = useState(initialActive);
  const [inactivePage, setInactivePage] = useState(initialInactive);
  const [unavailablePage, setUnavailablePage] = useState(initialUnavailable);
  const found = sortRoster(searchRoster(rows, query), sort);
  const active = pageOf(found.filter((row) => row.available && row.enabled), activePage);
  const inactive = pageOf(found.filter((row) => row.available && !row.enabled), inactivePage);
  const unavailable = pageOf(found.filter((row) => !row.available), unavailablePage);

  function search(value: string) {
    setQuery(value.slice(0, 100));
    setActivePage(1);
    setInactivePage(1);
    setUnavailablePage(1);
  }

  function chooseSort(column: RosterSortColumn) {
    setSort((current) => nextRosterSort(current, column));
    setActivePage(1);
    setInactivePage(1);
    setUnavailablePage(1);
  }

  return (
    <>
      <details className="card roster-add">
        <summary>Add a model</summary>
        <AddModelForm
          categories={categories}
          companies={companies}
          query={query}
          sort={sort}
          activePage={active.page}
          inactivePage={inactive.page}
          unavailablePage={unavailable.page}
        />
      </details>
      <div className="roster-search">
        <input
          type="search"
          value={query}
          placeholder="Search by name, company, or category"
          aria-label="Search models"
          onChange={(event) => search(event.target.value)}
        />
      </div>
      <RosterSection
        title="Active models"
        empty="No active models."
        rows={active.rows}
        page={active.page}
        pageCount={active.pageCount}
        query={query}
        sort={sort}
        categories={categories}
        companies={companies}
        activePage={active.page}
        inactivePage={inactive.page}
        unavailablePage={unavailable.page}
        onSort={chooseSort}
        onPage={setActivePage}
      />
      <RosterSection
        title="Inactive models"
        empty="No inactive models."
        rows={inactive.rows}
        page={inactive.page}
        pageCount={inactive.pageCount}
        query={query}
        sort={sort}
        categories={categories}
        companies={companies}
        activePage={active.page}
        inactivePage={inactive.page}
        unavailablePage={unavailable.page}
        onSort={chooseSort}
        onPage={setInactivePage}
      />
      <RosterSection
        title="Unavailable on OpenRouter"
        empty="No unavailable models."
        rows={unavailable.rows}
        page={unavailable.page}
        pageCount={unavailable.pageCount}
        query={query}
        sort={sort}
        categories={categories}
        companies={companies}
        activePage={active.page}
        inactivePage={inactive.page}
        unavailablePage={unavailable.page}
        onSort={chooseSort}
        onPage={setUnavailablePage}
      />
    </>
  );
}

function RosterSection({
  title,
  empty,
  rows,
  page,
  pageCount,
  query,
  sort,
  categories,
  companies,
  activePage,
  inactivePage,
  unavailablePage,
  onSort,
  onPage,
}: {
  title: string;
  empty: string;
  rows: RosterRow[];
  page: number;
  pageCount: number;
  query: string;
  sort: RosterSort;
  categories: CategoryRow[];
  companies: CompanyOption[];
  activePage: number;
  inactivePage: number;
  unavailablePage: number;
  onSort: (column: RosterSortColumn) => void;
  onPage: (page: number) => void;
}) {
  return (
    <section className="stack">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <div className="card empty">{query.trim() ? "No models match that search." : empty}</div>
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
                        <button type="button" className="roster-sort" onClick={() => onSort(column)}>
                          {sortLabels[column]}
                          {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                        </button>
                      </th>
                    );
                  })}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ModelRow
                    key={row.id}
                    row={row}
                    categories={categories}
                    companies={companies}
                    query={query}
                    sort={sort}
                    activePage={activePage}
                    inactivePage={inactivePage}
                    unavailablePage={unavailablePage}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="row pager">
            <div className="row">
              {page > 1 ? (
                <button type="button" className="button-quiet" onClick={() => onPage(page - 1)}>
                  Previous
                </button>
              ) : (
                <span className="button-quiet is-disabled">Previous</span>
              )}
              <span className="muted">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <button type="button" className="button-quiet" onClick={() => onPage(page + 1)}>
                  Next
                </button>
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
  companies,
  query,
  sort,
  activePage,
  inactivePage,
  unavailablePage,
}: {
  row: RosterRow;
  categories: CategoryRow[];
  companies: CompanyOption[];
  query: string;
  sort: RosterSort;
  activePage: number;
  inactivePage: number;
  unavailablePage: number;
}) {
  const panel = `edit-${row.id}`;
  return (
    <tr className={row.available && row.enabled ? undefined : "is-off"}>
      <td>{row.name}</td>
      <td>
        <span className="roster-company">
          <CompanyLogo src={row.logoUrl} />
          <span>{row.companyName}</span>
        </span>
      </td>
      <td>{originLabel(row.origin)}</td>
      <td>{row.year || "—"}</td>
      <td>{sizeLabel(row.size)}</td>
      <td>{row.difficulty ? difficultyLabel[row.difficulty] : "—"}</td>
      <td>{formatListPrice(row.inputUsdPerMtok)}</td>
      <td>{formatListPrice(row.outputUsdPerMtok)}</td>
      <td>{row.categoryNames || "—"}</td>
      <td>
        <div className="roster-buttons">
          {row.available ? (
            <form action={setModelEnabled}>
              <RosterReturnFields
                query={query}
                sort={sort}
                activePage={activePage}
                inactivePage={inactivePage}
                unavailablePage={unavailablePage}
              />
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="enabled" value={row.enabled ? "0" : "1"} />
              <button className={row.enabled ? "button-off" : "button-on"} type="submit">
                {row.enabled ? "OFF" : "ON"}
              </button>
            </form>
          ) : null}
          <button className="button-quiet" type="button" popoverTarget={panel}>
            Edit
          </button>
        </div>
        <div id={panel} popover="auto" className="roster-edit card">
          <form action={saveModel} className="stack">
            <h2>Edit {row.name}</h2>
            <RosterReturnFields
              query={query}
              sort={sort}
              activePage={activePage}
              inactivePage={inactivePage}
              unavailablePage={unavailablePage}
            />
            <input type="hidden" name="id" value={row.id} />
            <div className="roster-form">
              <ModelFields
                openrouterId={row.openrouterId}
                name={row.name}
                companyId={row.companyId}
                companies={companies}
                year={row.year}
                size={row.size}
                difficulty={row.difficulty ?? ""}
                categories={categories}
                categoryIds={row.categoryIds}
              />
            </div>
            {row.reasoning ? (
              <>
                <label className="check reasoning-off">
                  <input type="checkbox" name="reasoningOff" value="1" defaultChecked={row.reasoningOff} />
                  Turn reasoning off
                </label>
                <p className="muted">Otherwise it is sent at the lowest effort. The Costs page shows how much each model thinks.</p>
              </>
            ) : null}
            <div className="row">
              <SaveButton />
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
