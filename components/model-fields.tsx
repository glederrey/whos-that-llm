import type { OriginOption } from "@/lib/admin-origin";
import { difficulties, difficultyLabel, type Difficulty } from "@/lib/difficulty";

export type ModelFieldCategory = { id: string; name: string };

/** The origin select before the origins load, and the old rounds' three. */
const defaultOrigins: OriginOption[] = [
  { id: "us", name: "USA", flag: "🇺🇸" },
  { id: "cn", name: "China", flag: "🇨🇳" },
  { id: "eu", name: "Europe", flag: "🇪🇺" },
];

export function ModelFields({
  openrouterId = "",
  name = "",
  company = "",
  origin = "us",
  origins = defaultOrigins,
  year = "",
  releasedOn,
  size = "small",
  difficulty = "",
  categories = [],
  categoryIds = [],
  omitOpenRouterId = false,
}: {
  openrouterId?: string;
  name?: string;
  company?: string;
  origin?: string;
  origins?: OriginOption[];
  year?: string;
  releasedOn?: string;
  size?: string;
  difficulty?: Difficulty | "";
  categories?: ModelFieldCategory[];
  categoryIds?: string[];
  omitOpenRouterId?: boolean;
}) {
  return (
    <>
      {omitOpenRouterId ? null : (
        <label>
          OpenRouter id
          <input name="openrouterId" defaultValue={openrouterId} placeholder="openai/gpt-5.6-luna" required />
        </label>
      )}
      <label>
        Display name
        <input name="name" defaultValue={name} required />
      </label>
      <label>
        Company
        <input name="company" defaultValue={company} list="roster-companies" required />
      </label>
      <label>
        Origin
        <select name="origin" defaultValue={origin} required>
          {origin ? null : <option value="">Choose</option>}
          {origins.map((option) => (
            <option key={option.id} value={option.id}>
              {option.flag} {option.name}
            </option>
          ))}
        </select>
      </label>
      {releasedOn !== undefined ? (
        <label>
          Release date
          <input name="releasedOn" type="date" defaultValue={releasedOn} required />
        </label>
      ) : (
        <label>
          Year
          <input name="year" defaultValue={year} inputMode="numeric" required />
        </label>
      )}
      <label>
        Size
        <select name="size" defaultValue={size} required>
          {size ? null : <option value="">Choose</option>}
          <option value="nano">Nano</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="xxl">XXL</option>
        </select>
      </label>
      <label>
        Difficulty
        <select name="difficulty" defaultValue={difficulty} required>
          {difficulty ? null : <option value="">Choose</option>}
          {difficulties.map((item) => (
            <option key={item} value={item}>
              {difficultyLabel[item]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="class-picks">
        <legend>Categories</legend>
        {categories.length === 0 ? (
          <p className="muted">
            No categories yet. <a href="/admin/categories">Create one</a> before attaching it here.
          </p>
        ) : (
          categories.map((item) => (
            <label key={item.id}>
              <input type="checkbox" name="categoryId" value={item.id} defaultChecked={categoryIds.includes(item.id)} />
              {item.name}
            </label>
          ))
        )}
      </fieldset>
    </>
  );
}
