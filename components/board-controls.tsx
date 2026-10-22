import Link from "next/link";
import { allCompanies } from "@/lib/company";
import { anyDifficulty, difficulties, difficultyLabel, type BoardDifficulty } from "@/lib/difficulty";
import { boardHref, boardMiddle, type BoardChoice, type BoardMode, type BoardPeriod } from "@/lib/board-query";
import type { CategoryIconData } from "@/lib/category-icon";
import { CategoryIcon } from "./category-icon";
import { CompanyLogo } from "./company-logo";

export function BoardControls({
  base,
  modes,
  categories,
  companies,
  gameMode,
  period,
  difficulty,
  company,
  category,
}: {
  base: "/" | "/leaderboard";
  modes: BoardMode[];
  categories: Array<{ id: string; name: string; icon: CategoryIconData | null }>;
  companies: Array<{ id: string; name: string; logoUrl: string }>;
  gameMode: string;
  period: BoardPeriod;
  difficulty: BoardDifficulty;
  company: string;
  category: string;
}) {
  const choice: BoardChoice = { gameMode, period, difficulty, company, category };
  const middle = boardMiddle(gameMode, modes);
  return (
    <div className="board-controls">
      <div className="segmented board-controls-modes" role="group" aria-label="Mode">
        {modes.map((mode) =>
          mode.open ? (
            <Link
              key={mode.id}
              aria-pressed={mode.id === gameMode}
              href={boardHref(base, { ...choice, gameMode: mode.id })}
              scroll={false}
            >
              {mode.name}
            </Link>
          ) : (
            <span key={mode.id} aria-disabled="true" title="That mode is not open yet.">
              {mode.name}
            </span>
          ),
        )}
      </div>
      <div className="board-controls-middle">
        {middle?.kind === "difficulty" ? (
          <div className="segmented" role="group" aria-label="Difficulty">
            <Link aria-pressed={difficulty === anyDifficulty} href={boardHref(base, { ...choice, difficulty: anyDifficulty })} scroll={false}>
              Any difficulty
            </Link>
            {difficulties.map((tab) => (
              <Link
                key={tab}
                className={`difficulty-${tab}`}
                aria-pressed={tab === difficulty}
                href={boardHref(base, { ...choice, difficulty: tab })}
                scroll={false}
              >
                {difficultyLabel[tab]}
              </Link>
            ))}
          </div>
        ) : null}
        {middle?.kind === "class" ? (
          <CategoryMenu base={base} choice={choice} categories={categories} category={category} disabled={middle.disabled} />
        ) : null}
        {middle?.kind === "company" ? (
          <CompanyMenu base={base} choice={choice} companies={companies} company={company} disabled={middle.disabled} />
        ) : null}
      </div>
      <div className="segmented board-controls-period" role="group" aria-label="Period">
        <Link aria-pressed={period === "week"} href={boardHref(base, { ...choice, period: "week" })} scroll={false}>
          This week
        </Link>
        <Link aria-pressed={period === "month"} href={boardHref(base, { ...choice, period: "month" })} scroll={false}>
          This month
        </Link>
        <Link aria-pressed={period === "all"} href={boardHref(base, { ...choice, period: "all" })} scroll={false}>
          All time
        </Link>
      </div>
    </div>
  );
}

function CompanyMenu({
  base,
  choice,
  companies,
  company,
  disabled,
}: {
  base: "/" | "/leaderboard";
  choice: BoardChoice;
  companies: Array<{ id: string; name: string; logoUrl: string }>;
  company: string;
  disabled: boolean;
}) {
  const picked = companies.find((item) => item.id === company) ?? null;
  const label = picked?.name ?? "All companies";
  if (disabled) {
    return (
      <span className="company-menu is-disabled" aria-disabled="true" title="That mode is not open yet.">
        <span className="company-menu-summary">{label}</span>
      </span>
    );
  }
  return (
    <details key={company} className="company-menu">
      <summary aria-label="Company">
        {picked ? <CompanyLogo src={picked.logoUrl} /> : null}
        <span>{label}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="company-menu-list">
        <Link aria-current={company === allCompanies ? "true" : undefined} href={boardHref(base, { ...choice, company: allCompanies })} scroll={false}>
          All companies
        </Link>
        {companies.map((item) => (
          <Link
            key={item.id}
            aria-current={item.id === company ? "true" : undefined}
            href={boardHref(base, { ...choice, company: item.id })}
            scroll={false}
          >
            <CompanyLogo src={item.logoUrl} />
            <span>{item.name}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}

function CategoryMenu({
  base,
  choice,
  categories,
  category,
  disabled,
}: {
  base: "/" | "/leaderboard";
  choice: BoardChoice;
  categories: Array<{ id: string; name: string; icon: CategoryIconData | null }>;
  category: string;
  disabled: boolean;
}) {
  const picked = categories.find((item) => item.id === category) ?? null;
  const label = picked?.name ?? "All categories";
  if (disabled) {
    return (
      <span className="company-menu is-disabled" aria-disabled="true" title="That mode is not open yet.">
        <span className="company-menu-summary">{label}</span>
      </span>
    );
  }
  return (
    <details key={category} className="company-menu">
      <summary aria-label="Category">
        {picked ? <CategoryIcon icon={picked.icon} /> : null}
        <span>{label}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="company-menu-list">
        <Link aria-current={category === allCompanies ? "true" : undefined} href={boardHref(base, { ...choice, category: allCompanies })} scroll={false}>
          All categories
        </Link>
        {categories.map((item) => (
          <Link
            key={item.id}
            aria-current={item.id === category ? "true" : undefined}
            href={boardHref(base, { ...choice, category: item.id })}
            scroll={false}
          >
            <CategoryIcon icon={item.icon} />
            <span>{item.name}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}
