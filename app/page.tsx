import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoImage } from "@/components/logo-image";
import { BoardControls } from "@/components/board-controls";
import { BoardTable } from "@/components/board-table";
import { HomeCta } from "@/components/home-cta";
import { HomeDemo } from "@/components/home-demo";
import { boardChoice, boardModes, boardPool, isPoolBoard, selectedCategory, selectedCompany } from "@/lib/board-query";
import { allCompanies } from "@/lib/company";
import { anyDifficulty } from "@/lib/difficulty";
import { buildHomeDemoRounds } from "@/lib/home-demo-rounds";
import { groupByCompany, publicModels } from "@/lib/model-list";
import { leaderboard, listBoardOptions, listGameModes, serviceOrThrow } from "@/lib/rounds";
import { loadCatalog } from "@/lib/rounds-queries";
import { currentProfile } from "@/lib/session";
import { homeDescription, organizationJsonLd, socialMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = socialMetadata(homeDescription);

type HomeParams = { error?: string; gameMode?: string; period?: string; difficulty?: string; company?: string; category?: string };

export default async function HomePage({ searchParams }: { searchParams: Promise<HomeParams> }) {
  const params = await searchParams;
  if (params.error === "access_denied") redirect("/login?error=cancelled");
  const { user, username } = await currentProfile();
  if (user && !username) redirect("/welcome");
  const client = serviceOrThrow();
  const [gameModes, options] = await Promise.all([listGameModes(), listBoardOptions()]);
  const modes = boardModes(gameModes);
  const choice = boardChoice(params, modes);
  const view = {
    ...choice,
    company: choice.gameMode === "company" ? selectedCompany(choice.company, options.companies) : allCompanies,
    category: choice.gameMode === "class" ? selectedCategory(choice.category, options.categories) : allCompanies,
  };
  const [catalog, board] = await Promise.all([
    loadCatalog(client),
    leaderboard(view.gameMode, view.period, user?.id, view.difficulty, boardPool(view)),
  ]);
  const models = publicModels(catalog);
  const groups = groupByCompany(models);
  const rounds = buildHomeDemoRounds(models);
  const topRows = "rows" in board ? board.rows.slice(0, 5) : [];
  const strip = (copy: number) => (
    <div className="home-set" key={copy}>
      {groups.map((group) => (
        <span className="home-chip" key={`${copy}-${group.companyId}`}>
          {group.logoUrl ? <LogoImage src={group.logoUrl} width={22} height={22} /> : null}
          {group.companyName}
          <b>{group.models.length === 1 ? "1 model" : `${group.models.length} models`}</b>
        </span>
      ))}
    </div>
  );
  return (
    <div className="stack home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <section className="home-hero">
        <div className="home-text">
          <h1>
            Guess the hidden{" "}
            <span className="home-mark home-ai">
              AI
              <span className="home-logo" aria-hidden="true">
                <img className="for-light" src="/brand/logo-tail-left-light.png" alt="" />
                <img className="for-dark" src="/brand/logo-tail-left-dark.png" alt="" />
              </span>
            </span>
            .
          </h1>
          <p className="home-copy">
            Think you can tell AI models apart, like a wine? A hidden LLM answers you: ChatGPT, Claude, Gemini, or any of the{" "}
            <strong className="home-mark">{models.length.toLocaleString("en-US")} models</strong> by{" "}
            <strong className="home-mark">{groups.length.toLocaleString("en-US")} companies</strong> in play. You have ten messages to name it.
          </p>
          <HomeCta signedIn={Boolean(user && username)} />
        </div>
        {rounds.length > 0 ? <HomeDemo rounds={rounds} /> : null}
      </section>
      <div className="home-strip" aria-label="Companies and how many of their models can hide">
        <div className="home-track">
          {strip(0)}
          {strip(1)}
        </div>
      </div>
      <section className="home-board">
        <div className="home-board-head">
          <h2>Top 5</h2>
          <Link href="/leaderboard">Full leaderboard</Link>
        </div>
        <BoardControls base="/" modes={modes} categories={options.categories} companies={options.companies} {...view} />
        {topRows.length === 0 ? (
          <div className="card empty">No finished games on this board yet.</div>
        ) : (
          <BoardTable rows={topRows} showDifficulty={!isPoolBoard(view.gameMode) && view.difficulty === anyDifficulty} showCompany={isPoolBoard(view.gameMode)} />
        )}
      </section>
    </div>
  );
}
