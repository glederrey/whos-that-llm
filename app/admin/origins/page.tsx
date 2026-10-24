import { addOrigin, saveOrigin, toggleOrigin } from "@/app/admin/actions";
import { SectionNav } from "@/components/section-nav";
import { Twemoji } from "@/components/twemoji";
import { maxOriginName, originNotice } from "@/lib/admin-origin";
import { loadOriginList, type OriginRow } from "@/lib/admin-origins";

export const dynamic = "force-dynamic";

export default async function OriginsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  const notice = originNotice(params.notice);
  const origins = await loadOriginList();

  return (
    <div className="stack">
      <SectionNav />
      <h1>Origins</h1>
      <p className="muted">
        Where a lab comes from. Each company has exactly one; change it on the Companies page. The Origin game mode offers one button for every origin that has
        a model on the roster, in this order, so add an origin here before you add a company from a new place. A flag is
        one emoji. An origin is never deleted. Turn it off and it has no button and no model in the Origin mode; the other
        modes and the origin hint do not change.
      </p>
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      <details className="card roster-add">
        <summary>Add an origin</summary>
        <form action={addOrigin} className="stack">
          <OriginInputs />
          <div>
            <button className="button" type="submit">
              Add origin
            </button>
          </div>
        </form>
      </details>
      <OriginSection title="Active origins" empty="No active origins." rows={origins.filter((row) => row.enabled)} />
      <OriginSection title="Inactive origins" empty="No inactive origins." rows={origins.filter((row) => !row.enabled)} />
    </div>
  );
}

function OriginSection({ title, empty, rows }: { title: string; empty: string; rows: OriginRow[] }) {
  return (
    <section className="stack">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <div className="card empty">{empty}</div>
      ) : (
        <div className="card roster-card">
          <table className="roster compact origins">
            <thead>
              <tr>
                <th>Origin</th>
                <th>Companies</th>
                <th>Order</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((origin) => {
                const panel = `edit-origin-${origin.id}`;
                return (
                  <tr key={origin.id} className={origin.enabled ? undefined : "is-off"}>
                    <td>
                      <Twemoji emoji={origin.flag} /> {origin.name}
                    </td>
                    <td>{origin.companies.toLocaleString("en-US")}</td>
                    <td>{origin.sortOrder}</td>
                    <td>
                      <div className="roster-buttons">
                        <form action={toggleOrigin}>
                          <input type="hidden" name="id" value={origin.id} />
                          <input type="hidden" name="enabled" value={origin.enabled ? "0" : "1"} />
                          <button className={origin.enabled ? "button-off" : "button-on"} type="submit">
                            {origin.enabled ? "OFF" : "ON"}
                          </button>
                        </form>
                        <button className="button-quiet" type="button" popoverTarget={panel}>
                          Edit
                        </button>
                      </div>
                      <div id={panel} popover="auto" className="roster-edit card">
                        <form action={saveOrigin} className="stack">
                          <h2>Edit {origin.name}</h2>
                          <input type="hidden" name="id" value={origin.id} />
                          <div className="roster-form">
                            <OriginInputs name={origin.name} flag={origin.flag} sortOrder={origin.sortOrder} />
                          </div>
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OriginInputs({ name = "", flag = "", sortOrder }: { name?: string; flag?: string; sortOrder?: number }) {
  return (
    <>
      <label>
        Name
        <input name="name" defaultValue={name} maxLength={maxOriginName} required />
      </label>
      <label>
        Flag
        <input name="flag" defaultValue={flag} placeholder="🇯🇵" required />
      </label>
      <label>
        Order
        <input name="sortOrder" type="number" min={0} max={9999} defaultValue={sortOrder} placeholder="100" />
      </label>
    </>
  );
}
