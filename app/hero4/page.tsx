import type { Metadata } from "next";
import { HeroCta } from "@/components/hero-cta";
import { SearchDemo, type SearchDemoRound } from "@/components/hero-search-demo";
import { filterPublicModels, groupByCompany, publicModels } from "@/lib/model-list";
import { landingSnapshot, serviceOrThrow } from "@/lib/rounds";
import { loadCatalog } from "@/lib/rounds-queries";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hero preview", robots: { index: false, follow: false } };

const script = [
  { company: "Anthropic", q: "What should I name a cat that loves lasagna?", a: "Lasagnor. It sounds dignified, and it tells the whole house what he is being fed." },
  { company: "OpenAI", q: "Explain recursion in one sentence.", a: "Recursion is a function solving a problem by calling itself on a smaller piece of it." },
  { company: "Google", q: "Tell me a joke about databases.", a: "Why did the developer leave the database? Too many relationships, and no foreign key." },
];

/** Idea 4: hero1's example round ending in the real guess picker, hero3's company strip with model counts. */
export default async function Hero4() {
  const { user, username } = await currentProfile();
  const [snapshot, catalog] = await Promise.all([landingSnapshot(), loadCatalog(serviceOrThrow())]);
  const models = publicModels(catalog);
  const groups = groupByCompany(models);
  const rounds: SearchDemoRound[] = [];
  for (const step of script) {
    const answer = models.find((model) => model.companyName === step.company);
    if (!answer) continue;
    const query = (answer.name.match(/^[A-Za-z]+/)?.[0] ?? answer.name).slice(0, 6).toLowerCase();
    const others = filterPublicModels(models, query).filter((model) => model.id !== answer.id);
    const candidates = [others[0], answer, others[1]].filter(Boolean).map((model) => ({ id: model.id, name: model.name, companyName: model.companyName, logoUrl: model.logoUrl }));
    rounds.push({ q: step.q, a: step.a, query, candidates, answerId: answer.id });
  }
  const strip = (copy: number) => (
    <div className="h3-set" key={copy}>
      {groups.map((group) => (
        <span className="h3-chip" key={`${copy}-${group.companyId}`}>
          {group.logoUrl ? <img src={group.logoUrl} alt="" width={22} height={22} /> : null}
          {group.companyName}
          <b>{group.models.length}</b>
        </span>
      ))}
    </div>
  );
  return (
    <div className="stack landing h4">
      <section className="h4-hero">
        <div className="h1-text">
          <h1>
            Spot the <span className="h1-mark">AI</span>.
          </h1>
          <p className="hero-copy">Ten messages with a hidden model. Ask anything, then name it from the list. Fewer messages and fewer hints score more.</p>
          <HeroCta signedIn={Boolean(user && username)} label="Try a round" />
          <p className="h1-proof">
            {snapshot.models.toLocaleString("en-US")} models · {snapshot.companies.toLocaleString("en-US")} companies · {snapshot.players.toLocaleString("en-US")}{" "}
            {snapshot.players === 1 ? "player" : "players"}
          </p>
        </div>
        {rounds.length > 0 ? <SearchDemo rounds={rounds} /> : null}
      </section>
      <div className="h4-strip" aria-label="Companies and how many of their models can hide">
        <div className="h3-track h4-track">
          {strip(0)}
          {strip(1)}
        </div>
      </div>
    </div>
  );
}
