import { difficulties, difficultyLabel, type Difficulty } from "@/lib/difficulty";

export type ModelFieldCategory = { id: string; name: string };

export function ModelFields({
  openrouterId = "",
  name = "",
  company = "",
  region = "us",
  year = "",
  releasedOn,
  size = "small",
  difficulty = "",
  inputPrice = "",
  outputPrice = "",
  categories = [],
  categoryIds = [],
  omitOpenRouterId = false,
}: {
  openrouterId?: string;
  name?: string;
  company?: string;
  region?: string;
  year?: string;
  releasedOn?: string;
  size?: string;
  difficulty?: Difficulty | "";
  inputPrice?: string;
  outputPrice?: string;
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
        Region
        <select name="region" defaultValue={region} required>
          {region ? null : <option value="">Choose</option>}
          <option value="us">USA</option>
          <option value="cn">China</option>
          <option value="eu">Europe</option>
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
      <label>
        Input price
        <input name="inputPrice" defaultValue={inputPrice} inputMode="decimal" autoComplete="off" />
      </label>
      <label>
        Output price
        <input name="outputPrice" defaultValue={outputPrice} inputMode="decimal" autoComplete="off" />
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
