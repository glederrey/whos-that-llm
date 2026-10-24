import { addCompany, saveCompany, toggleCompany } from "@/app/admin/actions";
import { CompanyLogo } from "@/components/company-logo";
import { SectionNav } from "@/components/section-nav";
import { Twemoji } from "@/components/twemoji";
import { companyNotice, maxCompanyName } from "@/lib/admin-company";
import { loadOriginOptions } from "@/lib/admin-origins";
import type { OriginOption } from "@/lib/admin-origin";
import { loadCompanyList, type CompanyListRow } from "@/lib/admin-roster";
import { requireOwner } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireOwner();
  const params = await searchParams;
  const notice = companyNotice(params.notice);
  const [companies, origins] = await Promise.all([loadCompanyList(), loadOriginOptions()]);
  const originOf = new Map(origins.map((item) => [item.id, item]));
  const logos: LogoChoice[] = [];
  for (const company of companies) {
    if (company.logoPath && company.logoUrl && !logos.some((logo) => logo.path === company.logoPath)) {
      logos.push({ path: company.logoPath, url: company.logoUrl, name: company.name });
    }
  }

  return (
    <div className="stack">
      <SectionNav />
      <h1>Companies</h1>
      <p className="muted">
        A company is a lab. It has one origin and a logo, and every model belongs to one. Turn a company off to take it
        out of the Company game; its models stay in the other modes and a round already started stays playable. The
        count is models that are turned on.
      </p>
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      <details className="card roster-add">
        <summary>Add a company</summary>
        <form action={addCompany} className="stack">
          <div className="roster-form">
            <CompanyInputs origins={origins} logos={logos} />
          </div>
          <div>
            <button className="button" type="submit">
              Add company
            </button>
          </div>
        </form>
      </details>
      <CompanySection
        title="Active companies"
        empty="No active companies."
        rows={companies.filter((row) => row.enabled)}
        origins={origins}
        originOf={originOf}
        logos={logos}
      />
      <CompanySection
        title="Inactive companies"
        empty="No inactive companies."
        rows={companies.filter((row) => !row.enabled)}
        origins={origins}
        originOf={originOf}
        logos={logos}
      />
    </div>
  );
}

function CompanySection({
  title,
  empty,
  rows,
  origins,
  originOf,
  logos,
}: {
  title: string;
  empty: string;
  rows: CompanyListRow[];
  origins: OriginOption[];
  originOf: Map<string, OriginOption>;
  logos: LogoChoice[];
}) {
  return (
    <section className="stack">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <div className="card empty">{empty}</div>
      ) : (
        <div className="card roster-card">
          <table className="roster compact companies">
            <thead>
              <tr>
                <th>Company</th>
                <th>Origin</th>
                <th>Models</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((company) => {
                const origin = originOf.get(company.origin);
                const panel = `edit-company-${company.id}`;
                return (
                  <tr key={company.id} className={company.enabled ? undefined : "is-off"}>
                    <td>
                      <span className="roster-company">
                        <CompanyLogo src={company.logoUrl} />
                        <span>{company.name}</span>
                      </span>
                    </td>
                    <td>{origin ? <><Twemoji emoji={origin.flag} /> {origin.name}</> : company.origin}</td>
                    <td>{company.modelCount.toLocaleString("en-US")}</td>
                    <td>
                      <div className="roster-buttons">
                        <form action={toggleCompany}>
                          <input type="hidden" name="id" value={company.id} />
                          <input type="hidden" name="enabled" value={company.enabled ? "0" : "1"} />
                          <button className={company.enabled ? "button-off" : "button-on"} type="submit">
                            {company.enabled ? "OFF" : "ON"}
                          </button>
                        </form>
                        <button className="button-quiet" type="button" popoverTarget={panel}>
                          Edit
                        </button>
                      </div>
                      <div id={panel} popover="auto" className="roster-edit card">
                        <form action={saveCompany} className="stack">
                          <h2>Edit {company.name}</h2>
                          <input type="hidden" name="id" value={company.id} />
                          <div className="roster-form">
                            <CompanyInputs name={company.name} origin={company.origin} origins={origins} logos={logos} logoPath={company.logoPath} />
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

type LogoChoice = { path: string; url: string; name: string };

function CompanyInputs({
  name = "",
  origin = "",
  origins,
  logos,
  logoPath = "",
}: {
  name?: string;
  origin?: string;
  origins: OriginOption[];
  logos: LogoChoice[];
  logoPath?: string;
}) {
  return (
    <>
      <label className="span-2">
        Name
        <input name="name" defaultValue={name} maxLength={maxCompanyName} required />
      </label>
      <fieldset className="span-2 origin-picks">
        <legend>Origin</legend>
        {origins.map((option) => (
          <label key={option.id}>
            <input type="radio" name="origin" value={option.id} defaultChecked={option.id === origin} required />
            <Twemoji emoji={option.flag} /> {option.name}
          </label>
        ))}
      </fieldset>
      <fieldset className="span-2 logo-picks">
        <legend>Logo</legend>
        <div className="logo-grid">
          {logos.map((logo) => (
            <label key={logo.path} title={logo.name}>
              <input type="radio" name="logoPath" value={logo.path} defaultChecked={logo.path === logoPath} />
              <CompanyLogo src={logo.url} />
            </label>
          ))}
        </div>
        <label>
          Or upload a new one. It is saved under the company name, and a replaced file is deleted.
          <input name="logo" type="file" accept="image/svg+xml,image/png,image/webp" />
        </label>
      </fieldset>
    </>
  );
}
