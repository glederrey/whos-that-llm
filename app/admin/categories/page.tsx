import { DeleteCategoryForm } from "@/components/delete-category-form";
import { SectionNav } from "@/components/section-nav";
import { addCategory, saveCategory } from "@/app/admin/actions";
import { categoryDeleteMessage, categoryNotice } from "@/lib/admin-category";
import { loadCategoryList, type CategoryListRow } from "@/lib/admin-roster";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const notice = categoryNotice(params.notice);
  const failure = categoryDeleteMessage(params.error);
  const { categories, companies } = await loadCategoryList();

  return (
    <div className="stack">
      <SectionNav />
      <h1>Categories</h1>
      <p className="muted">
        A category is a set we define, not a lab&apos;s line. One model can be in several: only Opus, only the nano
        models, or a pile of obscure ones. Company is optional. A category has no logo of its own. The model count is
        models that are turned on.
      </p>
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      {failure ? (
        <p className="error" role="alert">
          {failure}
        </p>
      ) : null}
      <details className="card roster-add">
        <summary>Add a category</summary>
        <form action={addCategory} className="stack">
          <CategoryFields companies={companies} />
          <div>
            <button className="button" type="submit">
              Add category
            </button>
          </div>
        </form>
      </details>
      <div className="card roster-card">
        <table className="roster compact categories">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Company</th>
              <th>Models</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No categories yet.
                </td>
              </tr>
            ) : (
              categories.map((row) => <CategoryRowView key={row.id} row={row} companies={companies} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryRowView({ row, companies }: { row: CategoryListRow; companies: { id: string; name: string }[] }) {
  const panel = `edit-category-${row.id}`;
  const choices = companies;
  return (
    <tr>
      <td>{row.name}</td>
      <td>{row.description || "—"}</td>
      <td>{row.companyName ?? "None"}</td>
      <td>{row.modelCount.toLocaleString("en-US")}</td>
      <td>
        <div className="roster-buttons">
          <button className="button-quiet" type="button" popoverTarget={panel}>
            Edit
          </button>
          <DeleteCategoryForm id={row.id} name={row.name} />
        </div>
        <div id={panel} popover="auto" className="roster-edit card">
          <form action={saveCategory} className="stack">
            <h2>Edit {row.name}</h2>
            <input type="hidden" name="id" value={row.id} />
            <CategoryFields
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

function CategoryFields({
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
