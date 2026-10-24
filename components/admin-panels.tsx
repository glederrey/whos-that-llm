import { compact, percent, usd, type GameMetrics } from "@/lib/admin-metrics";
import type { OpenRouterSpend } from "@/lib/openrouter-spend";
import type { ActivityPeriod } from "@/lib/openrouter-usage";
import { SpendActivityTable } from "@/components/spend-activity-table";
import { periodSide, spendRows } from "@/lib/spend-table";

export type Figure = { label: string; value: string; note?: string };

export function Figures({ items }: { items: Figure[] }) {
  return (
    <dl className="stats stats-figures">
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
