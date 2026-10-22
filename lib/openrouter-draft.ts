import type { Region } from "./game";

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

export type CompanyChoice = { id: string; name: string; region: Region };

export type ModelDraft = {
  name: string;
  company: string;
  region: string;
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

export function draftFromOpenRouter(
  model: { id?: string; name?: unknown; created?: unknown },
  companies: CompanyChoice[],
): ModelDraft {
  const id = typeof model.id === "string" ? model.id : "";
  const slash = id.indexOf("/");
  const company = companyForOrg(slash === -1 ? "" : id.slice(0, slash), companies);
  return {
    name: typeof model.name === "string" ? model.name.trim() : "",
    company: company?.name ?? "",
    region: company?.region ?? "",
    releasedOn: releasedOnFromCreated(model.created),
  };
}
