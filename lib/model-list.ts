import { originFlag, originLabel, sizeLabel } from "./game-labels";
import type { CatalogModel } from "./rounds-shape";

/** A model on the public Models page. Nothing the game keeps hidden (difficulty, provider settings). */
export type PublicModel = {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  logoUrl: string;
  originName: string;
  originFlag: string;
  year: number;
  sizeName: string;
  openRouterUrl: string;
};

export type CompanyGroup = { companyId: string; companyName: string; logoUrl: string; models: PublicModel[] };

/** The model's page on OpenRouter. Each part of the id is encoded, the slash stays. */
export function openRouterUrl(openrouterId: string): string {
  return `https://openrouter.ai/${openrouterId.split("/").map(encodeURIComponent).join("/")}`;
}

/** Companies A to Z, then each company's newest model first. */
export function publicModels(catalog: readonly CatalogModel[]): PublicModel[] {
  return [...catalog]
    .sort((a, b) => a.companyName.localeCompare(b.companyName) || b.year - a.year || a.name.localeCompare(b.name))
    .map((model) => ({
      id: model.id,
      name: model.name,
      companyId: model.companyId,
      companyName: model.companyName,
      logoUrl: model.logoPath,
      originName: model.originName ?? originLabel(model.origin),
      originFlag: model.originFlag ?? originFlag(model.origin),
      year: model.year,
      sizeName: sizeLabel(model.size),
      openRouterUrl: openRouterUrl(model.openrouterId),
    }));
}

/** Case-insensitive match on the model, company, origin, size, or year. An empty query keeps every model. */
export function filterPublicModels(models: readonly PublicModel[], query: string): PublicModel[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...models];
  return models.filter((model) =>
    [model.name, model.companyName, model.originName, model.sizeName, String(model.year)].some((text) => text.toLowerCase().includes(needle)),
  );
}

/** Models in the order given, grouped by company. */
export function groupByCompany(models: readonly PublicModel[]): CompanyGroup[] {
  const groups: CompanyGroup[] = [];
  for (const model of models) {
    const last = groups[groups.length - 1];
    if (last && last.companyId === model.companyId) last.models.push(model);
    else groups.push({ companyId: model.companyId, companyName: model.companyName, logoUrl: model.logoUrl, models: [model] });
  }
  return groups;
}
