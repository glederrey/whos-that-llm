import { SectionNav } from "@/components/section-nav";
import { loadCompanyList } from "@/lib/admin-roster";
import { regionLabel } from "@/lib/game";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await loadCompanyList();

  return (
    <div className="stack">
      <SectionNav />
      <h1>Companies</h1>
      <p className="muted">A company is a lab. The count is models that are turned on.</p>
      <div className="card roster-card">
        <table className="roster compact companies">
          <thead>
            <tr>
              <th>Name</th>
              <th>Region</th>
              <th>Models</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  No companies yet.
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{regionLabel(company.region)}</td>
                  <td>{company.modelCount.toLocaleString("en-US")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
