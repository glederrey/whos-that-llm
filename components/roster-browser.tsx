"use client";

import { useState } from "react";
import { saveModel, setModelEnabled } from "@/app/admin/actions";
import { CompanyLogo } from "@/components/company-logo";
import { ModelFields } from "@/components/model-fields";
import { RosterReturnFields } from "@/components/roster-return-fields";
import { AddModelForm } from "@/components/add-model-form";
import { difficultyLabel } from "@/lib/difficulty";
import { regionLabel, sizeLabel } from "@/lib/game";
import { formatListPrice, formatPriceInput } from "@/lib/list-price";
import type { CategoryRow, RosterRow } from "@/lib/roster-row";
import { nextRosterSort, pageOf, searchRoster, sortRoster, type RosterSort, type RosterSortColumn } from "@/lib/roster-list";

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

export function RosterBrowser({
  rows,
  categories,
  initialQuery,
  initialSort,
  initialActive,
  initialInactive,
}: {
  rows: RosterRow[];
  categories: CategoryRow[];
  initialQuery: string;
  initialSort: RosterSort;
  initialActive: number;
  initialInactive: number;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<RosterSort>(initialSort);
  const [activePage, setActivePage] = useState(initialActive);
  const [inactivePage, setInactivePage] = useState(initialInactive);
  const found = sortRoster(searchRoster(rows, query), sort);
  const active = pageOf(found.filter((row) => row.enabled), activePage);
  const inactive = pageOf(found.filter((row) => !row.enabled), inactivePage);

  function search(value: string) {
    setQuery(value.slice(0, 100));
    setActivePage(1);
    setInactivePage(1);
  }

  function chooseSort(column: RosterSortColumn) {
    setSort((current) => nextRosterSort(current, column));
    setActivePage(1);
    setInactivePage(1);
  }

  return (
    <>
      <details className="card roster-add">
        <summary>Add a model</summary>
        <AddModelForm categories={categories} query={query} sort={sort} activePage={active.page} inactivePage={inactive.page} />
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
        activePage={active.page}
        inactivePage={inactive.page}
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
        activePage={active.page}
        inactivePage={inactive.page}
        onSort={chooseSort}
        onPage={setInactivePage}
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
  activePage,
  inactivePage,
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
  activePage: number;
  inactivePage: number;
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
                    query={query}
                    sort={sort}
                    activePage={activePage}
                    inactivePage={inactivePage}
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
