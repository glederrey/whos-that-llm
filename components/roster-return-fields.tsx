import type { RosterSort } from "@/lib/roster-list";

export function RosterReturnFields({
  query,
  sort,
  activePage,
  inactivePage,
}: {
  query: string;
  sort: RosterSort;
  activePage: number;
  inactivePage: number;
}) {
  return (
    <>
      {query ? <input type="hidden" name="q" value={query} /> : null}
      {sort ? (
        <>
          <input type="hidden" name="sort" value={sort.column} />
          <input type="hidden" name="dir" value={sort.dir} />
        </>
      ) : null}
      {activePage > 1 ? <input type="hidden" name="active" value={activePage} /> : null}
      {inactivePage > 1 ? <input type="hidden" name="inactive" value={inactivePage} /> : null}
    </>
  );
}
