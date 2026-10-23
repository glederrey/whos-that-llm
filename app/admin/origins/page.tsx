import { addOrigin, saveOrigin, toggleOrigin } from "@/app/admin/actions";
import { SectionNav } from "@/components/section-nav";
import { Twemoji } from "@/components/twemoji";
import { maxOriginName, originNotice } from "@/lib/admin-origin";
import { loadOriginList } from "@/lib/admin-origins";

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
        Where a lab comes from. Each company picks one. The Origin game mode offers one button for every origin that has
        a model on the roster, in this order, so add an origin here before you add a model from a new place. A flag is
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
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Origin</th>
              <th>Companies</th>
              <th>On</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {origins.map((origin) => (
              <tr key={origin.id}>
                <td>
                  <Twemoji emoji={origin.flag} /> {origin.name}
                </td>
                <td>{origin.companies.toLocaleString("en-US")}</td>
                <td>
                  <form action={toggleOrigin}>
                    <input type="hidden" name="id" value={origin.id} />
                    <input type="hidden" name="enabled" value={origin.enabled ? "0" : "1"} />
                    <button className="button" type="submit">
                      {origin.enabled ? "Turn off" : "Turn on"}
                    </button>
                  </form>
                </td>
                <td>
                  <form action={saveOrigin} className="roster-form">
                    <input type="hidden" name="id" value={origin.id} />
                    <OriginInputs name={origin.name} flag={origin.flag} sortOrder={origin.sortOrder} />
                    <button className="button" type="submit">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
