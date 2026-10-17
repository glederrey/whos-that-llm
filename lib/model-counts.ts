export type ModelMembership = {
  enabled: boolean;
  companyId: string;
  categoryIds: readonly string[];
};

/** Models that are turned off add nothing to a category or a company. */
export function enabledModelCounts(models: readonly ModelMembership[]): {
  byCategory: Map<string, number>;
  byCompany: Map<string, number>;
} {
  const byCategory = new Map<string, number>();
  const byCompany = new Map<string, number>();
  for (const model of models) {
    if (!model.enabled) continue;
    if (model.companyId) byCompany.set(model.companyId, (byCompany.get(model.companyId) ?? 0) + 1);
    for (const categoryId of new Set(model.categoryIds)) {
      if (!categoryId) continue;
      byCategory.set(categoryId, (byCategory.get(categoryId) ?? 0) + 1);
    }
  }
  return { byCategory, byCompany };
}
