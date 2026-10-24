import { CategoryIcon } from "@/components/category-icon";
import { CategoryModelPicker } from "@/components/category-model-picker";
import { EmojiPickerField } from "@/components/emoji-picker-field";
import { SectionNav } from "@/components/section-nav";
import { addCategory, saveCategory, toggleCategory } from "@/app/admin/actions";
import { categoryNotice, maxCategoryDescription } from "@/lib/admin-category";
import type { CustomModel } from "@/lib/custom-mode";
import { loadCategoryList, type CategoryListRow } from "@/lib/admin-roster";
import { requireOwner } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

type Company = { id: string; name: string };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const notice = categoryNotice(params.notice);
  const { categories, companies, models } = await loadCategoryList();

  return (
    <div className="stack">
      <SectionNav />
      <h1>Categories</h1>
      <p className="muted">
        A category is a set we define, not a lab&apos;s line. One model can be in several: only Opus, only the nano
        models, or a pile of obscure ones. Players pick one on the play page. A category needs at least two models
        that are turned on to be playable. Turning a category off hides it from the play page, the leaderboard, and the
        statistics; it keeps its models and its games.
      </p>
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      <details className="card roster-add">
        <summary>Add a category</summary>
        <form action={addCategory} className="stack">
          <CategoryFields companies={companies} models={models} />
          <div>
            <button className="button" type="submit">
              Add category
            </button>
          </div>
        </form>
      </details>
      <CategoryTable title="Active" rows={categories.filter((row) => row.enabled)} companies={companies} models={models} empty="No active categories." />
      <CategoryTable title="Inactive" rows={categories.filter((row) => !row.enabled)} companies={companies} models={models} empty="No inactive categories." />
    </div>
  );
}

function CategoryTable({
  title,
  rows,
  companies,
  models,
  empty,
}: {
  title: string;
  rows: CategoryListRow[];
  companies: Company[];
  models: CustomModel[];
  empty: string;
}) {
  return (
    <>
      <h2>{title}</h2>
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => <CategoryRowView key={row.id} row={row} companies={companies} models={models} />)
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CategoryRowView({ row, companies, models }: { row: CategoryListRow; companies: Company[]; models: CustomModel[] }) {
  const panel = `edit-category-${row.id}`;
  return (
    <tr className={row.enabled ? undefined : "is-off"}>
      <td>
        <CategoryIcon icon={row.icon} />
      </td>
      <td>{row.name}</td>
      <td>{row.description || "—"}</td>
      <td>{row.modelCount.toLocaleString("en-US")}</td>
      <td>
        <div className="roster-buttons">
          <form action={toggleCategory}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="enabled" value={row.enabled ? "0" : "1"} />
            <button className={row.enabled ? "button-off" : "button-on"} type="submit">
              {row.enabled ? "OFF" : "ON"}
            </button>
          </form>
          <button className="button-quiet" type="button" popoverTarget={panel}>
            Edit
          </button>
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
              icon={row.icon}
              companies={companies}
              models={models}
              modelIds={row.modelIds}
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
  iconKind = "default",
  iconValue = "",
  icon = null,
  companies,
  models,
  modelIds = [],
}: {
  name?: string;
  description?: string;
  iconKind?: string;
  iconValue?: string;
  icon?: CategoryListRow["icon"];
  companies: Company[];
  models: CustomModel[];
  modelIds?: string[];
}) {
  const removable = iconKind === "image" || iconKind === "emoji";
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
      <CategoryModelPicker models={models} defaultIds={modelIds} />
      <fieldset className="icon-picker span-2">
        <legend>Icon</legend>
        <p className="muted">
          If several are filled, the first wins: uploaded image, emoji, company logo, then the Who&apos;s that LLM logo.
        </p>
        {name ? (
          <div className="icon-picker-option">
            <span>Current</span>
            <CategoryIcon icon={icon} />
            {removable ? (
              <label className="check">
                <input type="checkbox" name="removeIcon" value="1" />
                <span>Remove current icon</span>
              </label>
            ) : null}
          </div>
        ) : null}
        <div className="icon-picker-option">
          <span>Upload image</span>
          <input type="file" name="image" accept="image/svg+xml,image/png,image/webp" aria-label="Image file" />
          <span className="muted">SVG, PNG, or WebP, 1 MB at most.</span>
        </div>
        <div className="icon-picker-option">
          <span>Emoji</span>
          <EmojiPickerField defaultValue={iconKind === "emoji" ? iconValue : ""} />
        </div>
        <div className="icon-picker-option">
          <span>Company logo</span>
          <select name="companyId" aria-label="Company" defaultValue={iconKind === "company" ? iconValue : ""}>
            <option value="">No company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    </div>
  );
}
