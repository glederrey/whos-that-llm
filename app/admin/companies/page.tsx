import { SectionNav } from "@/components/section-nav";
import { loadOriginOptions } from "@/lib/admin-origins";
import { loadCompanyList } from "@/lib/admin-roster";
import { originLabel } from "@/lib/game";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const [companies, origins] = await Promise.all([loadCompanyList(), loadOriginOptions()]);
  const originNames = new Map(origins.map((item) => [item.id, item.name]));

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
              <th>Origin</th>
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
                  <td>{originNames.get(company.origin) ?? originLabel(company.origin)}</td>
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
