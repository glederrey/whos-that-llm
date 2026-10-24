import type { Origin } from "./game";

/** OpenRouter org slug to a company id already on the roster. An org that is not here stays blank. */
const openRouterOrgCompanyId: Record<string, string> = {
  anthropic: "anthropic",
  google: "google",
  meta: "meta",
  "meta-llama": "meta",
  openai: "openai",
  perplexity: "perplexity",
  "x-ai": "xai",
  qwen: "alibaba",
  deepseek: "deepseek",
  moonshotai: "moonshot",
  "z-ai": "zai",
  mistralai: "mistral",
};

export type CompanyChoice = { id: string; name: string; origin: Origin };

export type ModelDraft = {
  name: string;
  companyId: string;
  releasedOn: string;
};

export function releasedOnFromCreated(created: unknown): string {
  const seconds = typeof created === "number" ? created : typeof created === "string" && created.trim() ? Number(created) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const iso = new Date(seconds * 1000).toISOString();
  return iso.slice(0, 10);
}

export function companyForOrg(org: string, companies: CompanyChoice[]): CompanyChoice | null {
  const mapped = openRouterOrgCompanyId[org];
  const id = mapped ?? (companies.some((company) => company.id === org) ? org : null);
  if (!id) return null;
  return companies.find((company) => company.id === id) ?? null;
}

function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * The company a model belongs to. OpenRouter names a model "Lab: Model", so the lab part is matched against the
 * company names first (exact, then one containing the other), and the org slug of the id is the fallback.
 */
export function companyForModel(openrouterId: string, name: unknown, companies: CompanyChoice[]): CompanyChoice | null {
  const lab = typeof name === "string" && name.includes(":") ? squash(name.slice(0, name.indexOf(":"))) : "";
  if (lab.length >= 3) {
    const exact = companies.find((company) => squash(company.name) === lab);
    if (exact) return exact;
    const near = companies.filter((company) => {
      const own = squash(company.name);
      return own.length >= 3 && (lab.startsWith(own) || own.startsWith(lab));
    });
    if (near.length === 1) return near[0];
  }
  const slash = openrouterId.indexOf("/");
  return companyForOrg(slash === -1 ? "" : openrouterId.slice(0, slash), companies);
}

export function draftFromOpenRouter(
  model: { id?: string; name?: unknown; created?: unknown },
  companies: CompanyChoice[],
): ModelDraft {
  const id = typeof model.id === "string" ? model.id : "";
  const company = companyForModel(id, model.name, companies);
  return {
    name: typeof model.name === "string" ? model.name.trim() : "",
    companyId: company?.id ?? "",
    releasedOn: releasedOnFromCreated(model.created),
  };
}
