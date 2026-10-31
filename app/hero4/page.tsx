import type { Metadata } from "next";
import { BoardControls } from "@/components/board-controls";
import { BoardTable } from "@/components/board-table";
import { allCompanies } from "@/lib/company";
import { anyDifficulty } from "@/lib/difficulty";
import { boardChoice, boardModes, boardPool, isPoolBoard, selectedCategory, selectedCompany } from "@/lib/board-query";
import Link from "next/link";
import { HeroCta } from "@/components/hero-cta";
import { SearchDemo, type SearchDemoRound, type SearchDemoTurn } from "@/components/hero-search-demo";
import { filterPublicModels, groupByCompany, publicModels } from "@/lib/model-list";
import { landingSnapshot, leaderboard, listBoardOptions, listGameModes, serviceOrThrow } from "@/lib/rounds";
import { loadCatalog } from "@/lib/rounds-queries";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hero preview", robots: { index: false, follow: false } };

type HintKey = "company" | "origin" | "year" | "size";
type Step = { company: string; right: boolean; q: string; a: string; hint?: HintKey };
/** Example rounds: at most three guesses, hints optional. The last step of a round is the right one and its model is the answer. */
const script: Step[][] = [
  [{ company: "Anthropic", right: true, q: "What should I name a cat that loves lasagna?", a: "Lasagnor. It sounds dignified, and it tells the whole house what he is being fed." }],
  [
    { company: "OpenAI", right: false, q: "Explain recursion in one sentence.", a: "Recursion is a function solving a problem by calling itself on a smaller piece of it." },
    { company: "Alibaba", right: true, q: "Now a haiku about Mondays.", a: "Alarm cuts the dark / the inbox grew overnight / coffee, then courage.", hint: "origin" },
  ],
  [{ company: "Google", right: true, q: "Tell me a joke about databases.", a: "Why did the developer leave the database? Too many relationships, and no foreign key.", hint: "year" }],
  [
    { company: "Meta", right: false, q: "What is the capital of Australia?", a: "Canberra. Plenty of people guess Sydney, but the capital was built on purpose, halfway between it and Melbourne." },
    { company: "DeepSeek", right: false, q: "Write a short apology for being late.", a: "Sorry I am late. The traffic won, but I brought coffee to make up for it.", hint: "year" },
    { company: "Mistral", right: true, q: "Suggest a name for a bakery.", a: "Levain & Co. It sounds warm, a little French, and it says bread before anyone reads the menu.", hint: "origin" },
  ],
];

const steps = [
  { title: "Ask", body: "Chat with a hidden model for up to ten messages. Ask anything and read the replies for clues." },
  { title: "Guess", body: "Search the list and name the model. A wrong guess costs 100 points, and you can guess again." },
  { title: "Score", body: "Fewer tokens multiply your score by up to 20, and playing without hints doubles it." },
];

/** Idea 4: hero1's example round ending in the real guess picker, hero3's company strip with model counts. */
type BoardParams = { gameMode?: string; period?: string; difficulty?: string; company?: string; category?: string };

export default async function Hero4({ searchParams }: { searchParams: Promise<BoardParams> }) {
  const params = await searchParams;
  const { user, username } = await currentProfile();
  const client = serviceOrThrow();
  const [gameModes, options] = await Promise.all([listGameModes(), listBoardOptions()]);
  const modes = boardModes(gameModes);
  const choice = boardChoice(params, modes);
  const view = {
    ...choice,
    company: choice.gameMode === "company" ? selectedCompany(choice.company, options.companies) : allCompanies,
    category: choice.gameMode === "class" ? selectedCategory(choice.category, options.categories) : allCompanies,
  };
  const [snapshot, catalog, board] = await Promise.all([
    landingSnapshot(),
    loadCatalog(client),
    leaderboard(view.gameMode, view.period, user?.id, view.difficulty, boardPool(view)),
  ]);
  const models = publicModels(catalog);
  const groups = groupByCompany(models);
  const rounds: SearchDemoRound[] = [];
  for (const steps of script) {
    const turns: SearchDemoTurn[] = [];
    const target = models.find((model) => model.companyName === steps[steps.length - 1].company);
    const shownHints: HintKey[] = [];
    for (const step of steps) {
      if (!target) continue;
      if (step.hint) shownHints.push(step.hint);
      // A guess has to agree with every hint shown so far, as a real player's would.
      const fits = (model: (typeof models)[number]) =>
        (!shownHints.includes("company") || model.companyName === target.companyName) &&
        (!shownHints.includes("origin") || model.originName === target.originName) &&
        (!shownHints.includes("year") || model.year === target.year) &&
        (!shownHints.includes("size") || model.sizeName === target.sizeName);
      const sameCompany = models.filter((model) => model.companyName === step.company);
      const answer = step.right ? target : (sameCompany.find(fits) ?? sameCompany[0]);
      if (!answer) continue;
      const hint: SearchDemoTurn["hint"] =
        step.hint === "company" ? { key: "company", value: target.companyName }
        : step.hint === "origin" ? { key: "origin", value: target.originName, flag: target.originFlag }
        : step.hint === "year" ? { key: "year", value: String(target.year) }
        : step.hint === "size" ? { key: "size", value: target.sizeName }
        : undefined;
      const query = (answer.name.match(/^[A-Za-z]+/)?.[0] ?? answer.name).slice(0, 6).toLowerCase();
      const found = filterPublicModels(models, query).filter((model) => model.id !== answer.id);
      const others = [...found.filter(fits), ...found.filter((model) => !fits(model))];
      const list = [others[0], answer, others[1]].filter(Boolean);
      const candidates = list.map((model) => ({ id: model.id, name: model.name, companyName: model.companyName, logoUrl: model.logoUrl }));
      turns.push({ q: step.q, a: step.a, query, candidates, pickId: answer.id, right: step.right, hint });
    }
    if (target && turns.length === steps.length) {
      rounds.push({
        turns,
        facts: {
          company: { value: target.companyName },
          origin: { value: target.originName, flag: target.originFlag },
          year: { value: String(target.year) },
          size: { value: target.sizeName },
        },
      });
    }
  }
  const topRows = "rows" in board ? board.rows.slice(0, 5) : [];
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
          <div className="h4-title">
            <span className="h4-logo" aria-hidden="true">
              <img className="for-light" src="/brand/logo-tail-right-light.png" alt="" />
              <img className="for-dark" src="/brand/logo-tail-right-dark.png" alt="" />
            </span>
            <h1>
              Guess the hidden <span className="h1-mark">AI</span>.
            </h1>
          </div>
          <p className="hero-copy">
            Think you can tell AI models apart, like a wine? In this guessing game, a hidden LLM answers you. It could be ChatGPT, Claude, Gemini, or any of the{" "}
            {snapshot.models.toLocaleString("en-US")} models in play. Ten messages, one guess. Take on the daily round or pick a game mode to climb the leaderboard.
          </p>
          <HeroCta signedIn={Boolean(user && username)} label="Sign up" signedInLabel="Try a round" />
          <dl className="h4-stats">
            <div className="card">
              <dt>Companies</dt>
              <dd>{snapshot.companies.toLocaleString("en-US")}</dd>
            </div>
            <div className="card">
              <dt>Models in play</dt>
              <dd>{snapshot.models.toLocaleString("en-US")}</dd>
            </div>
            <div className="card">
              <dt>Games today</dt>
              <dd>{snapshot.gamesToday.toLocaleString("en-US")}</dd>
            </div>
          </dl>
        </div>
        {rounds.length > 0 ? <SearchDemo rounds={rounds} /> : null}
      </section>
      <ol className="h4-steps">
        {steps.map((step, index) => (
          <li className="card" key={step.title}>
            <div className="h4-step-head">
              <span className="h4-step-n">{index + 1}</span>
              <h2>{step.title}</h2>
            </div>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
      <div className="h4-strip" aria-label="Companies and how many of their models can hide">
        <div className="h3-track h4-track">
          {strip(0)}
          {strip(1)}
        </div>
      </div>
      <section className="h4-board">
        <div className="h4-board-head">
          <h2>Top 5</h2>
          <Link href="/leaderboard">Full leaderboard</Link>
        </div>
        <BoardControls base="/hero4" modes={modes} categories={options.categories} companies={options.companies} {...view} />
        {topRows.length === 0 ? (
          <div className="card empty">No finished games on this board yet.</div>
        ) : (
          <BoardTable rows={topRows} showDifficulty={!isPoolBoard(view.gameMode) && view.difficulty === anyDifficulty} showCompany={isPoolBoard(view.gameMode)} />
        )}
      </section>
    </div>
  );
}
