import type { Metadata } from "next";
import { HeroCta } from "@/components/hero-cta";
import { SearchDemo, type SearchDemoRound } from "@/components/hero-search-demo";
import { filterPublicModels, groupByCompany, publicModels } from "@/lib/model-list";
import { landingSnapshot, serviceOrThrow } from "@/lib/rounds";
import { loadCatalog } from "@/lib/rounds-queries";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hero preview", robots: { index: false, follow: false } };

const script: { company: string; wrong?: boolean; turns: { q: string; a: string }[] }[] = [
  { company: "Anthropic", turns: [{ q: "What should I name a cat that loves lasagna?", a: "Lasagnor. It sounds dignified, and it tells the whole house what he is being fed." }] },
  {
    company: "OpenAI",
    wrong: true,
    turns: [
      { q: "Explain recursion in one sentence.", a: "Recursion is a function solving a problem by calling itself on a smaller piece of it." },
      { q: "Now a haiku about Mondays.", a: "Alarm cuts the dark / the inbox grew overnight / coffee, then courage." },
    ],
  },
  { company: "Google", turns: [{ q: "Tell me a joke about databases.", a: "Why did the developer leave the database? Too many relationships, and no foreign key." }] },
];

const steps = [
  { title: "Ask", body: "Chat with a hidden model for up to ten messages. Ask anything and read the replies for clues." },
  { title: "Guess", body: "Search the list and name the model. A wrong guess costs 100 points, and you can guess again." },
  { title: "Score", body: "Fewer tokens multiply your score by up to 20, and playing without hints doubles it." },
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
    const list = [others[0], answer, others[1]].filter(Boolean);
    const candidates = list.map((model) => ({ id: model.id, name: model.name, companyName: model.companyName, logoUrl: model.logoUrl }));
    rounds.push({ turns: step.turns, query, candidates, answerId: answer.id, wrongId: step.wrong ? others[0]?.id : undefined });
  }
  const strip = (copy: number) => (
    <div className="h3-set" key={copy}>
      {groups.map((group) => (
        <span className="h3-chip" key={`${copy}-${group.companyId}`}>
          {group.logoUrl ? <img src={group.logoUrl} alt="" width={22} height={22} /> : null}
          {group.companyName}
          <b>{group.models.length === 1 ? "1 model" : `${group.models.length} models`}</b>
        </span>
      ))}
    </div>
  );
  return (
    <div className="stack landing h4">
      <section className="h4-hero">
        <div className="h1-text">
          <h1>
            Guess the hidden <span className="h1-mark">AI</span>.
          </h1>
          <p className="hero-copy">Chat with a mystery model, then name it from the list. The fewer tokens you use and the fewer hints you buy, the more you score.</p>
          <HeroCta signedIn={Boolean(user && username)} label="Try a round" />
          <dl className="h4-stats">
            <div className="card">
              <dt>models to find</dt>
              <dd>{snapshot.models.toLocaleString("en-US")}</dd>
            </div>
            <div className="card">
              <dt>companies</dt>
              <dd>{snapshot.companies.toLocaleString("en-US")}</dd>
            </div>
            <div className="card">
              <dt>messages per round</dt>
              <dd>10</dd>
            </div>
          </dl>
        </div>
        {rounds.length > 0 ? <SearchDemo rounds={rounds} /> : null}
      </section>
      <div className="h4-strip" aria-label="Companies and how many of their models can hide">
        <div className="h3-track h4-track">
          {strip(0)}
          {strip(1)}
        </div>
      </div>
      <ol className="h4-steps">
        {steps.map((step, index) => (
          <li className="card" key={step.title}>
            <span className="h4-step-n">{index + 1}</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
