/** All companies is the combined Company board. A row still names the company it was played as. */
export const allCompanies = "all";

export type CompanyCount = {
  id: string;
  name: string;
  models: number;
};

/**
 * Every company, in the order given.
 * The number is turned-on models only. A turned-off model never counts.
 */
export function companyModelCounts(
  companies: readonly { id: string; name: string }[],
  models: readonly { companyId: string; enabled?: boolean }[],
): CompanyCount[] {
  const counts = new Map<string, number>();
  for (const model of models) {
    if (model.enabled === false) continue;
    counts.set(model.companyId, (counts.get(model.companyId) ?? 0) + 1);
  }
  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    models: counts.get(company.id) ?? 0,
  }));
}

/** A company id from the lobby or the leaderboard URL. Anything else is All companies. */
export function parseBoardCompany(value: string | null | undefined): string {
  const text = value?.trim().toLowerCase() ?? "";
  if (!text || text === allCompanies) return allCompanies;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(text)) return allCompanies;
  return text;
}
