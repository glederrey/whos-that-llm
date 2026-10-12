import { difficultyLabel, type Difficulty } from "@/lib/difficulty";
import { Avatar } from "./avatar";

export type BoardRow = {
  rank: number;
  name: string;
  score: number;
  mine?: boolean;
  avatarUrl?: string | null;
  seed?: string;
  difficulty?: Difficulty | null;
  noHint?: boolean;
};

export function BoardTable({ rows, showDifficulty = false }: { rows: BoardRow[]; showDifficulty?: boolean }) {
  const showMarks = showDifficulty || rows.some((row) => row.noHint);
  return (
    <div className="card board-card">
      <table className="board">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            {showMarks ? <th className="marks" /> : null}
            <th className="num">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const medal = row.rank >= 1 && row.rank <= 3 ? (["gold", "silver", "bronze"] as const)[row.rank - 1] : null;
            const classes = [medal ? `medal ${medal}` : "", row.mine ? "mine" : ""].filter(Boolean).join(" ");
            return (
              <tr key={row.rank} className={classes || undefined} aria-current={row.mine ? "true" : undefined}>
                <td className="rank">
                  <span className="rank-chip" data-medal={medal ?? undefined}>
                    {row.rank}
                  </span>
                </td>
                <td className="name">
                  <span className="player">
                    <Avatar seed={row.seed || row.name} src={row.avatarUrl} size={28} />
                    <span className="player-name">{row.name}</span>
                    {row.mine ? <span className="you-tag">You</span> : null}
                  </span>
                </td>
                {showMarks ? (
                  <td className="marks">
                    <span className="player-marks">
                      {row.noHint ? <span className="board-chip no-hints">No hints</span> : null}
                      {showDifficulty ? (
                        row.difficulty ? (
                          <span className={`board-chip difficulty-${row.difficulty}`}>{difficultyLabel[row.difficulty]}</span>
                        ) : (
                          <span className="mark-slot" />
                        )
                      ) : null}
                    </span>
                  </td>
                ) : null}
                <td className="num">{row.score.toLocaleString("en-US")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
