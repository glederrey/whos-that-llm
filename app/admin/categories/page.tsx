import { CategoryIcon } from "@/components/category-icon";
import { DeleteCategoryForm } from "@/components/delete-category-form";
import { EmojiPickerField } from "@/components/emoji-picker-field";
import { SectionNav } from "@/components/section-nav";
import { addCategory, saveCategory } from "@/app/admin/actions";
import { categoryDeleteMessage, categoryNotice, maxCategoryDescription } from "@/lib/admin-category";
import { loadCategoryList, type CategoryListRow } from "@/lib/admin-roster";

export const dynamic = "force-dynamic";

type Company = { id: string; name: string };

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
        models, or a pile of obscure ones. Players pick one on the play page. A category needs at least two models
        that are turned on to be playable. The icon is a company logo, an uploaded image, or an emoji.
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
              <th>Icon</th>
              <th>Name</th>
              <th>Description</th>
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

function CategoryRowView({ row, companies }: { row: CategoryListRow; companies: Company[] }) {
  const panel = `edit-category-${row.id}`;
  return (
    <tr>
      <td>
        <CategoryIcon icon={row.icon} />
      </td>
      <td>{row.name}</td>
      <td>{row.description || "—"}</td>
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
              iconKind={row.iconKind}
              iconValue={row.iconValue}
              companies={companies}
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
  iconKind = "company",
  iconValue = "",
  companies,
}: {
  name?: string;
  description?: string;
  iconKind?: string;
  iconValue?: string;
  companies: Company[];
}) {
  return (
    <div className="roster-form">
      <label>
        Name
        <input name="name" defaultValue={name} required />
      </label>
      <label className="span-2">
        Description (up to {maxCategoryDescription} characters)
        <textarea name="description" defaultValue={description} maxLength={maxCategoryDescription} />
      </label>
      <fieldset className="icon-picker span-2">
        <legend>Icon</legend>
        <div className="icon-picker-option">
          <label className="check">
            <input type="radio" name="iconKind" value="company" defaultChecked={iconKind === "company"} />
            <span>Company logo</span>
          </label>
          <select name="companyId" aria-label="Company" defaultValue={iconKind === "company" ? iconValue : ""}>
            <option value="">Choose a company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="icon-picker-option">
          <label className="check">
            <input type="radio" name="iconKind" value="image" defaultChecked={iconKind === "image"} />
            <span>Upload image</span>
          </label>
          <input type="file" name="image" accept="image/svg+xml,image/png,image/webp" aria-label="Image file" />
          <span className="muted">{iconKind === "image" ? "Leave empty to keep the current image. " : ""}SVG, PNG, or WebP, 1 MB at most.</span>
        </div>
        <div className="icon-picker-option">
          <label className="check">
            <input type="radio" name="iconKind" value="emoji" defaultChecked={iconKind === "emoji"} />
            <span>Emoji</span>
          </label>
          <EmojiPickerField defaultValue={iconKind === "emoji" ? iconValue : ""} />
        </div>
      </fieldset>
    </div>
  );
}
