import { SectionNav } from "@/components/section-nav";
import { requireOwner } from "@/lib/admin-access";
import { compact, decimal, percent, usd, type GameMetrics } from "@/lib/admin-metrics";
import { loadAdminStats, loadRoster } from "@/lib/admin-roster";
import { loadGameMetrics } from "@/lib/admin-stats";
import { loadOpenRouterSpend, type OpenRouterSpend } from "@/lib/openrouter-spend";
import type { ActivityPeriod, ModelActivity } from "@/lib/openrouter-usage";

export const dynamic = "force-dynamic";

type Figure = { label: string; value: string; note?: string };

export default async function AdminStatsPage() {
  await requireOwner();
  const [stats, roster, metrics, spend] = await Promise.all([
    loadAdminStats(),
    loadRoster(),
    loadGameMetrics(),
    loadOpenRouterSpend(),
  ]);
  const byId = new Map(roster.rows.map((row) => [row.id, row.name]));
  const byOpenRouterId = new Map(roster.rows.map((row) => [row.openrouterId, row.name]));
  const figures: Figure[] = [
    { label: "Models in the roster", value: stats.roster.toLocaleString("en-US") },
    { label: "Active models", value: stats.active.toLocaleString("en-US") },
    { label: "Players", value: stats.players.toLocaleString("en-US") },
    { label: "Games today (UTC)", value: stats.gamesToday.toLocaleString("en-US") },
    { label: "Total games", value: stats.games.toLocaleString("en-US") },
  ];

  return (
    <div className="stack">
      <SectionNav />
      <h1>Stats</h1>
      <Figures items={figures} />
      <p className="muted">Players are accounts that have started a game. Games today uses UTC.</p>

      <h2>OpenRouter spend</h2>
      <p className="muted">
        What OpenRouter billed, read from OpenRouter when this page loads. Totals come from the API key. The per-model
        breakdown is account activity for the last 30 completed UTC days.
      </p>
      <Spend spend={spend} nameFor={(slug) => byOpenRouterId.get(slug) ?? slug} />

      <h2>Games</h2>
      <p className="muted">
        From our own tables. Rates use finished games: solved, missed, and given up. Cost and tokens come from the
        figures OpenRouter returned with each reply.
      </p>
      <Figures items={gameFigures(metrics)} />

      <h2>Games over time</h2>
      <DayBars days={metrics.days} />

      <h2>Which models are hardest to find</h2>
      <p className="muted">
        Hidden models, hardest first. Solve rate is solved over finished games. Cost is everything our ledger recorded
        for that model, all time.
      </p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Hidden model</th>
              <th>Games</th>
              <th>Solve rate</th>
              <th>Messages when solved</th>
              <th>Requests</th>
              <th>Tokens</th>
              <th>Cost</th>
              <th>Cost per game</th>
            </tr>
          </thead>
          <tbody>
            {metrics.models.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  No games yet.
                </td>
              </tr>
            ) : (
              metrics.models.map((row) => (
                <tr key={row.modelId}>
                  <td>{byId.get(row.modelId) ?? row.modelId}</td>
                  <td>
                    {row.games.toLocaleString("en-US")}
                    {row.finished !== row.games ? <span className="muted"> ({row.finished} finished)</span> : null}
                  </td>
                  <td>{percent(row.solveRate)}</td>
                  <td>{decimal(row.avgMessagesWhenSolved)}</td>
                  <td>
                    {row.requests.toLocaleString("en-US")}
                    {row.failedRequests > 0 ? <span className="muted"> ({row.failedRequests} failed)</span> : null}
                  </td>
                  <td>{compact(row.tokens)}</td>
                  <td>{usd(row.costUsd)}</td>
                  <td>{usd(row.costPerGame)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function gameFigures(metrics: GameMetrics): Figure[] {
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
      note: `${metrics.correctGuesses} of ${metrics.guesses} guesses. ${decimal(metrics.guessesPerGame)} per game`,
    },
    { label: "Messages per game", value: decimal(metrics.messagesPerGame), note: "Finished games" },
    { label: "Tokens per game", value: compact(metrics.tokensPerGame), note: "Prompt plus completion" },
    { label: "Cost per game", value: usd(metrics.costPerGame), note: "Finished games" },
    {
      label: "Cost per solved game",
      value: usd(metrics.costPerSolvedGame),
      note: "Spend on finished games over solved games",
    },
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

function Figures({ items }: { items: Figure[] }) {
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

function Spend({ spend, nameFor }: { spend: OpenRouterSpend; nameFor: (slug: string) => string }) {
  const { totals, activity } = spend;
  const figures: Figure[] = [];
  if (totals.ok) {
    figures.push(
      { label: "Paid, all time", value: usd(totals.value.allTime), note: "This API key" },
      { label: "Paid this UTC week", value: usd(totals.value.week), note: `Today ${usd(totals.value.today)}` },
      { label: "Paid this UTC month", value: usd(totals.value.month) },
    );
  }
  if (activity.ok) {
    const { week, month } = activity.value;
    figures.push(
      { label: "Paid, last 7 days", value: usd(week.usd), note: periodNote(week) },
      { label: "Paid, last 30 days", value: usd(month.usd), note: periodNote(month) },
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
        <ActivityTable week={activity.value.week} month={activity.value.month} nameFor={nameFor} />
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

function ActivityTable({
  week,
  month,
  nameFor,
}: {
  week: ActivityPeriod;
  month: ActivityPeriod;
  nameFor: (slug: string) => string;
}) {
  const weekBy = new Map(week.models.map((row) => [row.model, row]));
  const slugs = month.models.map((row) => row.model);
  for (const row of week.models) if (!slugs.includes(row.model)) slugs.push(row.model);
  const monthBy = new Map(month.models.map((row) => [row.model, row]));
  return (
    <div className="card roster-card">
      <table className="roster compact">
        <thead>
          <tr>
            <th rowSpan={2}>Model</th>
            <th colSpan={3} className="group">
              Last 7 days
            </th>
            <th colSpan={3} className="group">
              Last 30 days
            </th>
          </tr>
          <tr>
            <th>Paid</th>
            <th>Requests</th>
            <th>Tokens</th>
            <th>Paid</th>
            <th>Requests</th>
            <th>Tokens</th>
          </tr>
        </thead>
        <tbody>
          {slugs.length === 0 ? (
            <tr>
              <td colSpan={7} className="muted">
                No OpenRouter activity in the last 30 days.
              </td>
            </tr>
          ) : (
            <>
              <tr className="total-row">
                <td>All models</td>
                <Cells row={totalRow(week)} />
                <Cells row={totalRow(month)} />
              </tr>
              {slugs.map((slug) => (
                <tr key={slug}>
                  <td title={slug}>{nameFor(slug)}</td>
                  <Cells row={weekBy.get(slug)} />
                  <Cells row={monthBy.get(slug)} />
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function totalRow(period: ActivityPeriod): ModelActivity {
  return {
    model: "",
    requests: period.requests,
    promptTokens: period.promptTokens,
    completionTokens: period.completionTokens,
    reasoningTokens: 0,
    usd: period.usd,
  };
}

function Cells({ row }: { row: ModelActivity | undefined }) {
  if (!row) {
    return (
      <>
        <td>{usd(0)}</td>
        <td>0</td>
        <td>0</td>
      </>
    );
  }
  return (
    <>
      <td>{usd(row.usd)}</td>
      <td>{row.requests.toLocaleString("en-US")}</td>
      <td title={`${row.promptTokens.toLocaleString("en-US")} in, ${row.completionTokens.toLocaleString("en-US")} out`}>
        {compact(row.promptTokens + row.completionTokens)}
      </td>
    </>
  );
}

function DayBars({ days }: { days: GameMetrics["days"] }) {
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
