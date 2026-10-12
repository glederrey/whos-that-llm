import { compact, decimal, percent, usd, type GameMetrics } from "@/lib/admin-metrics";
import type { OpenRouterSpend } from "@/lib/openrouter-spend";
import type { ActivityPeriod } from "@/lib/openrouter-usage";
import { SpendActivityTable } from "@/components/spend-activity-table";
import { periodSide, spendRows } from "@/lib/spend-table";

export type Figure = { label: string; value: string; note?: string };

export function Figures({ items }: { items: Figure[] }) {
  return (
    <dl className="stats">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.note ? <p className="stat-note">{item.note}</p> : null}
        </div>
      ))}
    </dl>
  );
}

export function playFigures(metrics: GameMetrics): Figure[] {
  return [
    {
      label: "Solve rate",
      value: percent(metrics.solveRate),
      note: `${metrics.solved} solved of ${metrics.finished} finished`,
    },
    {
      label: "Give-ups",
      value: metrics.givenUp.toLocaleString("en-US"),
      note: `${percent(metrics.giveUpRate)} of finished. ${metrics.missed} missed, ${metrics.open} open`,
    },
    {
      label: "Correct guesses",
      value: percent(metrics.guessAccuracy),
      note: `${metrics.correctGuesses} of ${metrics.guesses} guesses on finished games. ${decimal(metrics.guessesPerGame)} per finished game`,
    },
    { label: "Messages per game", value: decimal(metrics.messagesPerGame), note: "Finished games" },
    { label: "Tokens per game", value: compact(metrics.tokensPerGame), note: "Prompt plus completion" },
    {
      label: "Unfinished games",
      value: percent(metrics.unfinishedRate),
      note: `${metrics.unfinished.toLocaleString("en-US")} of ${metrics.games.toLocaleString("en-US")}`,
    },
  ];
}

export function costFigures(metrics: GameMetrics): Figure[] {
  return [
    { label: "Cost per game", value: usd(metrics.costPerGame), note: "Finished games" },
    {
      label: "Ledger spend",
      value: usd(metrics.ledgerCostUsd),
      note: `${metrics.ledgerRequests.toLocaleString("en-US")} requests, ${compact(metrics.ledgerTokens)} tokens`,
    },
    {
      label: "Failed calls",
      value: metrics.failedRequests.toLocaleString("en-US"),
      note: `${percent(metrics.ledgerRequests > 0 ? metrics.failedRequests / metrics.ledgerRequests : null)} of requests`,
    },
  ];
}

export function Spend({ spend, nameFor }: { spend: OpenRouterSpend; nameFor: (slug: string) => string }) {
  const { totals, activity } = spend;
  const figures: Figure[] = [];
  if (totals.ok) {
    figures.push({ label: "Paid, all time", value: usd(totals.value.allTime), note: "This API key" });
  }
  if (activity.ok) {
    const { week, month } = activity.value;
    figures.push(
      { label: "Paid, last 30 days", value: usd(month.usd), note: periodNote(month) },
      { label: "Paid, last 7 days", value: usd(week.usd), note: periodNote(week) },
    );
  }
  return (
    <div className="stack">
      {totals.ok ? null : (
        <p className="error" role="alert">
          OpenRouter totals could not be loaded. {totals.error}
        </p>
      )}
      {figures.length > 0 ? <Figures items={figures} /> : null}
      {activity.ok ? (
        <SpendActivityTable
          rows={spendRows(activity.value.week, activity.value.month, nameFor)}
          week={periodSide(activity.value.week)}
          month={periodSide(activity.value.month)}
        />
      ) : (
        <p className="error" role="alert">
          OpenRouter per-model usage could not be loaded. {activity.error}
        </p>
      )}
    </div>
  );
}

function periodNote(period: ActivityPeriod): string {
  return `${period.requests.toLocaleString("en-US")} requests, ${compact(period.promptTokens + period.completionTokens)} tokens`;
}

export function DayBars({ days }: { days: GameMetrics["days"] }) {
  const peak = Math.max(1, ...days.map((day) => day.games));
  return (
    <div className="card">
      <div className="daybars" role="img" aria-label="Games started per UTC day, last 14 days">
        {days.map((day) => (
          <div key={day.date} className="daybar" title={`${day.date}: ${day.games} games, ${day.solved} solved`}>
            <span className="daybar-count">{day.games}</span>
            <span className="daybar-track">
              <i className="daybar-all" style={{ height: `${(day.games / peak) * 100}%` }}>
                <i className="daybar-solved" style={{ height: day.games ? `${(day.solved / day.games) * 100}%` : 0 }} />
              </i>
            </span>
            <span className="daybar-date">{day.date.slice(5)}</span>
          </div>
        ))}
      </div>
      <p className="muted">Games started per UTC day, last 14 days. The teal part is solved.</p>
    </div>
  );
}
