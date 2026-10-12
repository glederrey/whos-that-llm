import Link from "next/link";
import { anyDifficulty, difficulties, difficultyLabel, type BoardDifficulty } from "@/lib/difficulty";
import { boardHref, boardMiddle, type BoardChoice, type BoardMode, type BoardPeriod } from "@/lib/board-query";

export function BoardControls({
  base,
  modes,
  classes,
  companies,
  category,
  period,
  difficulty,
}: {
  base: "/" | "/leaderboard";
  modes: BoardMode[];
  classes: Array<{ id: string; name: string }>;
  companies: Array<{ id: string; name: string }>;
  category: string;
  period: BoardPeriod;
  difficulty: BoardDifficulty;
}) {
  const choice: BoardChoice = { category, period, difficulty };
  const middle = boardMiddle(category, modes);
  return (
    <div className="board-controls">
      <div className="segmented board-controls-modes" role="group" aria-label="Mode">
        {modes.map((mode) =>
          mode.open ? (
            <Link
              key={mode.id}
              aria-pressed={mode.id === category}
              href={boardHref(base, { ...choice, category: mode.id })}
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
          <select aria-label="Class" disabled={middle.disabled} defaultValue="" title={middle.disabled ? "That mode is not open yet." : undefined}>
            <option value="">Class</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : null}
        {middle?.kind === "company" ? (
          <select
            aria-label="Company"
            disabled={middle.disabled}
            defaultValue=""
            title={middle.disabled ? "That mode is not open yet." : undefined}
          >
            <option value="">Company</option>
            {companies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
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
