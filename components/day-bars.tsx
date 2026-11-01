import type { DayCount } from "@/lib/admin-metrics";

/** "2026-10-11" as 11.10. */
function dayMonth(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

/**
 * Games per UTC day, stacked: solved, failed, given up, and open (a round still being played, which only the
 * admin chart counts). The legend lists Open only when `showOpen` is set.
 */
export function DayBars({ days, label, note, showOpen = false }: { days: DayCount[]; label: string; note: string; showOpen?: boolean }) {
  const peak = Math.max(1, ...days.map((day) => day.games));
  const share = (part: number, whole: number) => (whole ? `${(part / whole) * 100}%` : 0);
  return (
    <div className="card">
      <div className="daybars" role="img" aria-label={label}>
        {days.map((day) => (
          <div
            key={day.date}
            className="daybar"
            title={`${dayMonth(day.date)}: ${day.games} games, ${day.solved} solved, ${day.missed} failed, ${day.givenUp} given up${showOpen ? `, ${day.open} open` : ""}`}
          >
            <span className="daybar-count">{day.games}</span>
            <span className="daybar-track">
              <span className="daybar-all" style={{ height: `${(day.games / peak) * 100}%` }}>
                <i className="daybar-solved" style={{ height: share(day.solved, day.games) }} />
                <i className="daybar-failed" style={{ height: share(day.missed, day.games) }} />
                <i className="daybar-gave-up" style={{ height: share(day.givenUp, day.games) }} />
                <i className="daybar-open" style={{ height: share(day.open, day.games) }} />
              </span>
            </span>
            <span className="daybar-date">{dayMonth(day.date)}</span>
          </div>
        ))}
      </div>
      <div className="daybar-foot">
        <ul className="daybar-legend" aria-hidden="true">
          <li>
            <i className="daybar-solved" />
            Solved
          </li>
          <li>
            <i className="daybar-failed" />
            Failed
          </li>
          <li>
            <i className="daybar-gave-up" />
            Given up
          </li>
          {showOpen ? (
            <li>
              <i className="daybar-open" />
              Open
            </li>
          ) : null}
        </ul>
        <p className="muted">{note}</p>
      </div>
    </div>
  );
}
