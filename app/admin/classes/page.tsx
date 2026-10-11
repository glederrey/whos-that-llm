import { SectionNav } from "@/components/section-nav";
import { addClass, saveClass } from "@/app/admin/actions";
import { classNotice } from "@/lib/admin-class";
import { loadClassList, type ClassRow } from "@/lib/admin-roster";

export const dynamic = "force-dynamic";

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const params = await searchParams;
  const notice = classNotice(params.notice);
  const { classes, companies } = await loadClassList();

  return (
    <div className="stack">
      <SectionNav />
      <h1>Classes</h1>
      <p className="muted">
        A class groups models for a later game. One model can be in several. Company is optional: Opus can belong to
        Anthropic, and GPT vs Claude can belong to none. A class has no logo of its own.
      </p>
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      <details className="card roster-add">
        <summary>Add a class</summary>
        <form action={addClass} className="stack">
          <ClassFields companies={companies} />
          <div>
            <button className="button" type="submit">
              Add class
            </button>
          </div>
        </form>
      </details>
      <div className="card roster-card">
        <table className="roster compact classes">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Company</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No classes yet.
                </td>
              </tr>
            ) : (
              classes.map((row) => <ClassRowView key={row.id} row={row} companies={companies} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClassRowView({ row, companies }: { row: ClassRow; companies: { id: string; name: string }[] }) {
  const panel = `edit-class-${row.id}`;
  const choices = companies;
  return (
    <tr>
      <td>{row.name}</td>
      <td>{row.description || "—"}</td>
      <td>{row.companyName ?? "None"}</td>
      <td>
        <div className="roster-buttons">
          <button className="button-quiet" type="button" popoverTarget={panel}>
            Edit
          </button>
        </div>
        <div id={panel} popover="auto" className="roster-edit card">
          <form action={saveClass} className="stack">
            <h2>Edit {row.name}</h2>
            <input type="hidden" name="id" value={row.id} />
            <ClassFields
              name={row.name}
              description={row.description}
              companyId={row.companyId ?? ""}
              companies={choices}
            />
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

function ClassFields({
  name = "",
  description = "",
  companyId = "",
  companies,
}: {
  name?: string;
  description?: string;
  companyId?: string;
  companies: { id: string; name: string }[];
}) {
  return (
    <div className="roster-form">
      <label>
        Name
        <input name="name" defaultValue={name} required />
      </label>
      <label>
        Company
        <select name="companyId" defaultValue={companyId}>
          <option value="">None</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>
      <label className="span-2">
        Description
        <textarea name="description" defaultValue={description} maxLength={500} />
      </label>
    </div>
  );
}
