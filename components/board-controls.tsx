import { anyDifficulty, difficulties, difficultyLabel, type BoardDifficulty } from "@/lib/difficulty";
import { boardHref, boardMiddles, type BoardChoice, type BoardMode, type BoardPeriod } from "@/lib/board-query";

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
  const middles = boardMiddles(category, modes);
  return (
    <div className="board-controls">
      <div className="segmented board-controls-modes" role="group" aria-label="Mode">
        {modes.map((mode) =>
          mode.open ? (
            <a key={mode.id} aria-pressed={mode.id === category} href={boardHref(base, { ...choice, category: mode.id })}>
              {mode.name}
            </a>
          ) : (
            <span key={mode.id} aria-disabled="true" title="That mode is not open yet.">
              {mode.name}
            </span>
          ),
        )}
      </div>
      <div className="board-controls-middle">
        {middles.map((middle) => {
          if (middle.kind === "difficulty") {
            return (
              <div key="difficulty" className="segmented" role="group" aria-label="Difficulty">
                <a aria-pressed={difficulty === anyDifficulty} href={boardHref(base, { ...choice, difficulty: anyDifficulty })}>
                  Any difficulty
                </a>
                {difficulties.map((tab) => (
                  <a
                    key={tab}
                    className={`difficulty-${tab}`}
                    aria-pressed={tab === difficulty}
                    href={boardHref(base, { ...choice, difficulty: tab })}
                  >
                    {difficultyLabel[tab]}
                  </a>
                ))}
              </div>
            );
          }
          if (middle.kind === "class") {
            return (
              <select
              key="class"
              aria-label="Class"
              disabled={middle.disabled}
              defaultValue=""
              title={middle.disabled ? "That mode is not open yet." : undefined}
            >
                <option value="">Class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            );
          }
          return (
            <select
              key="company"
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
          );
        })}
      </div>
      <div className="segmented board-controls-period" role="group" aria-label="Period">
        <a aria-pressed={period === "week"} href={boardHref(base, { ...choice, period: "week" })}>
          This week (UTC)
        </a>
        <a aria-pressed={period === "all"} href={boardHref(base, { ...choice, period: "all" })}>
          All time
        </a>
      </div>
    </div>
  );
}
