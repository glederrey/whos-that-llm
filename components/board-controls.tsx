import { anyDifficulty, difficulties, difficultyLabel, type BoardDifficulty } from "@/lib/difficulty";
import { boardHref, type BoardChoice, type BoardPeriod } from "@/lib/board-query";

export function BoardControls({
  base,
  modes,
  category,
  period,
  difficulty,
}: {
  base: "/" | "/leaderboard";
  modes: Array<{ id: string; name: string }>;
  category: string;
  period: BoardPeriod;
  difficulty: BoardDifficulty;
}) {
  const choice: BoardChoice = { category, period, difficulty };
  return (
    <div className="board-controls">
      <div className="segmented" role="group" aria-label="Mode">
        {modes.map((mode) => (
          <a key={mode.id} aria-pressed={mode.id === category} href={boardHref(base, { ...choice, category: mode.id })}>
            {mode.name}
          </a>
        ))}
      </div>
      <div className="segmented" role="group" aria-label="Difficulty">
        <a aria-pressed={difficulty === anyDifficulty} href={boardHref(base, { ...choice, difficulty: anyDifficulty })}>
          Any difficulty
        </a>
        {difficulties.map((tab) => (
          <a key={tab} className={`difficulty-${tab}`} aria-pressed={tab === difficulty} href={boardHref(base, { ...choice, difficulty: tab })}>
            {difficultyLabel[tab]}
          </a>
        ))}
      </div>
      <div className="segmented" role="group" aria-label="Period">
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
