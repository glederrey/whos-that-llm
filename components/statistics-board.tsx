"use client";

import { useState } from "react";
import { OriginFlag } from "@/components/origin-flag";
import { Twemoji } from "@/components/twemoji";
import { compact, decimal, percent, type DayCount } from "@/lib/admin-metrics";
import { originLabel, sizeLabel, type Origin, type Size } from "@/lib/game";
import {
  statisticModes,
  type CategoryStat,
  type CustomReport,
  type GameModeReport,
  type ConfusionPair,
  type ModelOutcome,
  type OriginPickRow,
  type Outcome,
  type PublicStats,
  type StatisticModeId,
  type TraitRow,
} from "@/lib/public-stats";

type Figure = { label: string; value: string; note?: string };

type OriginNames = Record<string, { name: string; flag: string }>;

export function StatisticsBoard({
  stats,
  names,
  origins,
}: {
  stats: PublicStats;
  names: Record<string, string>;
  origins: OriginNames;
}) {
  const [mode, setMode] = useState<StatisticModeId>("main");
  const nameFor = (id: string) => names[id] ?? id;
  const selected = stats.gameModes.find((gameMode) => gameMode.id === mode);

  return (
    <div className="stack">
      <div className="segmented stat-modes" role="group" aria-label="Game mode">
        {statisticModes.map((item) =>
          item.enabled ? (
            <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>
              {item.name}
            </button>
          ) : (
            <span key={item.id} aria-disabled="true" title="That mode is not open yet.">
              {item.name}
            </span>
          ),
        )}
      </div>
      {mode === "main" ? (
        <MainStats stats={stats} nameFor={nameFor} />
      ) : mode === "class" ? (
        <CategoryMode categories={stats.categories} report={selected} nameFor={nameFor} />
      ) : mode === "origin" ? (
        <OriginMode report={selected} nameFor={nameFor} origins={origins} />
      ) : (
        <ModeStats report={selected} nameFor={nameFor} />
      )}
    </div>
  );
}

function MainStats({ stats, nameFor }: { stats: PublicStats; nameFor: (id: string) => string }) {
  return (
    <>
      <h2>Games</h2>
      <Figures items={gameFigures(stats.outcome)} />
      <h2>Games over time</h2>
      <DayBars days={stats.days} />
      <h2>Which models are hardest to find</h2>
      <p className="muted">Hidden models, hardest first. Solve rate is solved over finished games.</p>
      <ModelTable rows={stats.models} nameFor={nameFor} />
      <h2>Models people mix up</h2>
      <p className="muted">Wrong names on finished games. Each row is the hidden model and the one that was named instead.</p>
      <ConfusionTable rows={stats.confusion} nameFor={nameFor} />
      <h2>Size</h2>
      <p className="muted">By the size of the hidden model.</p>
      <TraitTable kind="size" rows={stats.sizes} />
      <h2>Origin</h2>
      <p className="muted">By the origin of the hidden model. Origin found is a finished game where a guess got the origin.</p>
      <TraitTable kind="origin" rows={stats.origins} />
    </>
  );
}

function ModeStats({ report, nameFor }: { report: GameModeReport | undefined; nameFor: (id: string) => string }) {
  if (!report || report.outcome === null) {
    return (
      <div className="card empty">
        <p>No finished games in this game mode yet.</p>
      </div>
    );
  }
  return (
    <>
      <h2>{report.name}</h2>
      <Figures items={gameFigures(report.outcome, report.custom)} />
      <h2>Games over time</h2>
      <DayBars days={report.days} />
      {report.custom ? <CustomStats custom={report.custom} total={report.finished} nameFor={nameFor} /> : null}
      <h2>Which models are hardest to find</h2>
      <p className="muted">Hidden models, hardest first. Solve rate is solved over finished games.</p>
      <ModelTable rows={report.models} nameFor={nameFor} />
      <h2>Models people mix up</h2>
      <p className="muted">Wrong names on finished games. Each row is the hidden model and the one that was named instead.</p>
      <ConfusionTable rows={report.confusion} nameFor={nameFor} />
      <h2>Size</h2>
      <p className="muted">By the size of the hidden model.</p>
      <TraitTable kind="size" rows={report.sizes} />
      <h2>Origin</h2>
      <p className="muted">By the origin of the hidden model. Origin found is a finished game where a guess got the origin.</p>
      <TraitTable kind="origin" rows={report.origins} />
    </>
  );
}

function OriginMode({
  report,
  nameFor,
  origins,
}: {
  report: GameModeReport | undefined;
  nameFor: (id: string) => string;
  origins: OriginNames;
}) {
  if (!report || report.outcome === null) {
    return (
      <div className="card empty">
        <p>No finished games in this game mode yet.</p>
      </div>
    );
  }
  const outcome = report.outcome;
  const label = (id: string) => (
    <span className="roster-company">
      {origins[id] ? <Twemoji emoji={origins[id].flag} /> : null}
      {origins[id]?.name ?? originLabel(id)}
    </span>
  );
  return (
    <>
      <h2>{report.name}</h2>
      <Figures
        items={[
          { label: "Solve rate", value: percent(outcome.solveRate), note: `${outcome.solved} solved of ${outcome.finished} finished` },
          { label: "Messages per game", value: decimal(outcome.messagesPerGame), note: "Finished games" },
          { label: "Tokens per game", value: compact(outcome.tokensPerGame), note: "Prompt plus completion" },
        ]}
      />
      <h2>Games over time</h2>
      <DayBars days={report.days} />
      <h2>By real origin</h2>
      <p className="muted">
        For each real origin: how often it was found, and how many times each origin was picked.
      </p>
      <OriginPickTable rows={report.originPicks} label={label} />
      <h2>Hardest and easiest models</h2>
      <p className="muted">Hidden models, hardest first. Solve rate is solved over finished games.</p>
      <ModelTable rows={report.models} nameFor={nameFor} />
    </>
  );
}

function OriginPickTable({ rows, label }: { rows: OriginPickRow[]; label: (id: string) => React.ReactNode }) {
  const columns = rows.map((row) => row.origin);
  return (
    <div className="card roster-card">
      <table className="roster compact">
        <thead>
          <tr>
            <th rowSpan={2}>Real origin</th>
            <th rowSpan={2}>Games</th>
            <th rowSpan={2}>Found</th>
            <th className="group" colSpan={columns.length}>
              Picked
            </th>
          </tr>
          <tr>
            {columns.map((id, index) => (
              <th key={id} className={index === 0 ? "group" : "pick"}>
                {label(id)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.origin}>
              <td>{label(row.origin)}</td>
              <td>{row.games.toLocaleString("en-US")}</td>
              <td>{row.games === 0 ? "n/a" : percent(row.foundRate)}</td>
              {columns.map((id, index) => (
                <td key={id} className={index === 0 ? "group" : "pick"}>
                  {(row.picks.find((pick) => pick.origin === id)?.count ?? 0).toLocaleString("en-US")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryMode({
  categories,
  report,
  nameFor,
}: {
  categories: CategoryStat[];
  report: GameModeReport | undefined;
  nameFor: (id: string) => string;
}) {
  return (
    <>
      {report?.outcome ? <ModeStats report={report} nameFor={nameFor} /> : null}
      <h2>By category</h2>
      <p className="muted">
        By the categories of the hidden model. A round counts in each category that model belongs to. A model with no
        category is left out.
      </p>
      {categories.length === 0 ? <div className="card empty">No categories turned on yet.</div> : <CategoryTable rows={categories} />}
    </>
  );
}

function CustomStats({ custom, total, nameFor }: { custom: CustomReport; total: number; nameFor: (id: string) => string }) {
  const peak = Math.max(1, ...custom.sizes.map((bucket) => bucket.rounds));
  return (
    <>
      <h2>Models per round</h2>
      <div className="card">
        <div className="daybars poolbars" role="img" aria-label="Custom rounds by number of models picked">
          {custom.sizes.map((bucket) => (
            <div key={bucket.label} className="daybar" title={`${bucket.label} models: ${bucket.rounds} rounds`}>
              <span className="daybar-count">{bucket.rounds}</span>
              <span className="daybar-track">
                <i className="daybar-all" style={{ height: `${(bucket.rounds / peak) * 100}%`, background: "var(--teal)" }} />
              </span>
              <span className="daybar-date">{bucket.label}</span>
            </div>
          ))}
        </div>
        <p className="muted">Finished Custom rounds by the number of models in the pool.</p>
      </div>
      <h2>Most picked models</h2>
      <p className="muted">Models that were in the most Custom pools. Share is the part of the {total.toLocaleString("en-US")} finished rounds that held the model.</p>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              <th>Model</th>
              <th>Rounds</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {custom.picked.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  No games yet.
                </td>
              </tr>
            ) : (
              custom.picked.map((row) => (
                <tr key={row.modelId}>
                  <td>{nameFor(row.modelId)}</td>
                  <td>{row.rounds.toLocaleString("en-US")}</td>
                  <td>{percent(row.share)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function gameFigures(outcome: Outcome, custom: CustomReport | null = null): Figure[] {
  return [
    {
      label: "Solve rate",
      value: percent(outcome.solveRate),
      note: `${outcome.solved} solved of ${outcome.finished} finished`,
    },
    {
      label: "Give-ups",
      value: outcome.givenUp.toLocaleString("en-US"),
      note: `${percent(outcome.giveUpRate)} of finished. ${outcome.missed} missed`,
    },
    {
      label: "Correct guesses",
      value: percent(outcome.guessAccuracy),
      note: `${outcome.correctGuesses} of ${outcome.guesses} guesses on finished games`,
    },
    { label: "Messages per game", value: decimal(outcome.messagesPerGame), note: "Finished games" },
    { label: "Tokens per game", value: compact(outcome.tokensPerGame), note: "Prompt plus completion" },
    custom
      ? { label: "Models per round", value: decimal(custom.avgModels), note: "Average size of the pool the player picked" }
      : {
          label: "Origin found",
          value: percent(outcome.originFoundRate),
          note: "Finished games where a guess got the origin",
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

function ModelTable({ rows, nameFor }: { rows: ModelOutcome[]; nameFor: (id: string) => string }) {
  return (
    <div className="card roster-card">
      <table className="roster compact">
        <thead>
          <tr>
            <th>Hidden model</th>
            <th>Games</th>
            <th>Solve rate</th>
            <th>Messages when solved</th>
            <th>Tokens</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                No games yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.modelId}>
                <td>{nameFor(row.modelId)}</td>
                <td>{row.games.toLocaleString("en-US")}</td>
                <td>{percent(row.solveRate)}</td>
                <td>{decimal(row.avgMessagesWhenSolved)}</td>
                <td>{compact(row.tokens)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ConfusionTable({ rows, nameFor }: { rows: ConfusionPair[]; nameFor: (id: string) => string }) {
  return (
    <div className="card roster-card">
      <table className="roster compact">
        <thead>
          <tr>
            <th>Hidden model</th>
            <th>Named instead</th>
            <th>Times</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="muted">
                No wrong guesses yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={`${row.hiddenModelId}-${row.guessedModelId}`}>
                <td>{nameFor(row.hiddenModelId)}</td>
                <td>{nameFor(row.guessedModelId)}</td>
                <td>{row.count.toLocaleString("en-US")}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CategoryTable({ rows }: { rows: CategoryStat[] }) {
  return (
    <div className="card roster-card">
      <table className="roster compact">
        <thead>
          <tr>
            <th>Category</th>
            <th>Games</th>
            <th>Solve rate</th>
            <th>Messages when solved</th>
            <th>Tokens per game</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.name}</td>
              <td>{row.finished === 0 ? "0" : row.games.toLocaleString("en-US")}</td>
              <td>{row.finished === 0 ? "n/a" : percent(row.solveRate)}</td>
              <td>{decimal(row.avgMessagesWhenSolved)}</td>
              <td>{compact(row.tokensPerGame)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TraitTable({ kind, rows }: { kind: "size" | "origin"; rows: TraitRow[] }) {
  return (
    <div className="card roster-card">
      <table className="roster compact">
        <thead>
          <tr>
            <th>{kind === "size" ? "Size" : "Origin"}</th>
            <th>Games</th>
            <th>Solve rate</th>
            <th>Messages when solved</th>
            {kind === "origin" ? <th>Origin found</th> : null}
            <th>Tokens per game</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                {kind === "origin" && row.key !== "unknown" ? (
                  <span className="roster-company">
                    <OriginFlag origin={originLabel(row.key as Origin)} />
                    {traitLabel(kind, row.key)}
                  </span>
                ) : (
                  traitLabel(kind, row.key)
                )}
              </td>
              <td>{row.finished === 0 ? "0" : row.games.toLocaleString("en-US")}</td>
              <td>{row.finished === 0 ? "n/a" : percent(row.solveRate)}</td>
              <td>{decimal(row.avgMessagesWhenSolved)}</td>
              {kind === "origin" ? <td>{row.finished === 0 ? "n/a" : percent(row.originFoundRate)}</td> : null}
              <td>{compact(row.tokensPerGame)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function traitLabel(kind: "size" | "origin", key: string): string {
  if (key === "unknown") return "Not recorded";
  if (kind === "size") return sizeLabel(key as Size);
  return originLabel(key as Origin);
}

function DayBars({ days }: { days: DayCount[] }) {
  const peak = Math.max(1, ...days.map((day) => day.games));
  return (
    <div className="card">
      <div className="daybars" role="img" aria-label="Finished games started per UTC day, last 14 days">
        {days.map((day) => (
          <div key={day.date} className="daybar" title={`${day.date}: ${day.games} finished games, ${day.solved} solved`}>
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
      <p className="muted">Finished games started per UTC day, last 14 days. The teal part is solved.</p>
    </div>
  );
}
