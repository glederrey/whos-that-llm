import { CompanyLogo } from "@/components/company-logo";
import { SectionNav } from "@/components/section-nav";
import { addModel, saveModel, setModelEnabled } from "@/app/admin/actions";
import { rosterNotice } from "@/lib/admin-model";
import { loadRoster } from "@/lib/admin-roster";
import { regionLabel, sizeLabel } from "@/lib/game";

export const dynamic = "force-dynamic";

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const params = await searchParams;
  const notice = rosterNotice(params.notice);
  const { rows, companies } = await loadRoster();

  return (
    <div className="stack">
      <SectionNav />
      <h1>Models</h1>
      <p className="muted">
        Turning a model off leaves it out of new rounds. Games already started keep the model they drew.
      </p>
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      <form action={addModel} className="card stack">
        <h2>Add a model</h2>
        <div className="roster-form">
          <ModelFields />
        </div>
        <p className="muted">A new model stays off until you turn it on. The family follows the company.</p>
        <div>
          <button className="button" type="submit">
            Add model
          </button>
        </div>
      </form>
      <div className="card roster-card">
        <table className="roster">
          <thead>
            <tr>
              <th>Company</th>
              <th>Region</th>
              <th>Year</th>
              <th>Size</th>
              <th>OpenRouter id</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.enabled ? undefined : "is-off"}>
                <td>
                  <span className="roster-company">
                    <CompanyLogo src={row.logoUrl} />
                    <span>{row.companyName}</span>
                  </span>
                </td>
                <td>{regionLabel(row.region)}</td>
                <td>{row.year || "—"}</td>
                <td>{sizeLabel(row.size)}</td>
                <td>{row.openrouterId}</td>
                <td>{row.enabled ? "On" : "Off"}</td>
                <td className="roster-actions">
                  <form action={setModelEnabled}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="enabled" value={row.enabled ? "0" : "1"} />
                    <button className="button-quiet" type="submit">
                      {row.enabled ? "Turn off" : "Turn on"}
                    </button>
                  </form>
                  <details>
                    <summary>Edit</summary>
                    <form action={saveModel} className="stack">
                      <input type="hidden" name="id" value={row.id} />
                      <div className="roster-form">
                        <ModelFields
                          openrouterId={row.openrouterId}
                          name={row.name}
                          company={row.companyName}
                          region={row.region}
                          year={row.year}
                          size={row.size}
                        />
                      </div>
                      <p className="muted">Region belongs to the company. New games use it.</p>
                      <div>
                        <button className="button" type="submit">
                          Save
                        </button>
                      </div>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <datalist id="roster-companies">
        {companies.map((company) => (
          <option key={company.id} value={company.name} />
        ))}
      </datalist>
    </div>
  );
}

function ModelFields({
  openrouterId = "",
  name = "",
  company = "",
  region = "us",
  year = "",
  size = "small",
}: {
  openrouterId?: string;
  name?: string;
  company?: string;
  region?: string;
  year?: string;
  size?: string;
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
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>
    </>
  );
}
