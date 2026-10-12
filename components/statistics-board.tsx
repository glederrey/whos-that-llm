"use client";

import { useState } from "react";
import { RegionFlag } from "@/components/region-flag";
import { compact, decimal, percent, type DayCount } from "@/lib/admin-metrics";
import { regionLabel, sizeLabel, type Region, type Size } from "@/lib/game";
import {
  statisticModes,
  type CategoryStat,
  type GameModeReport,
  type ConfusionPair,
  type ModelOutcome,
  type Outcome,
  type PublicStats,
  type StatisticModeId,
  type TraitRow,
} from "@/lib/public-stats";

type Figure = { label: string; value: string; note?: string };

export function StatisticsBoard({ stats, names }: { stats: PublicStats; names: Record<string, string> }) {
  const [mode, setMode] = useState<StatisticModeId>("main");
  const nameFor = (id: string) => names[id] ?? id;
  const allModels = stats.gameModes.find((gameMode) => gameMode.id === "all");

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
      {mode === "all" ? (
        <ModeStats report={allModels} nameFor={nameFor} />
      ) : mode === "class" ? (
        <CategoryMode categories={stats.categories} />
      ) : (
        <MainStats stats={stats} nameFor={nameFor} />
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
      <h2>Region</h2>
      <p className="muted">By the region of the hidden model. Region found is a finished game where a guess got the region.</p>
      <TraitTable kind="region" rows={stats.regions} />
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
      <Figures items={gameFigures(report.outcome)} />
      <h2>Games over time</h2>
      <DayBars days={report.days} />
      <h2>Which models are hardest to find</h2>
      <p className="muted">Hidden models, hardest first. Solve rate is solved over finished games.</p>
      <ModelTable rows={report.models} nameFor={nameFor} />
      <h2>Models people mix up</h2>
      <p className="muted">Wrong names on finished games. Each row is the hidden model and the one that was named instead.</p>
      <ConfusionTable rows={report.confusion} nameFor={nameFor} />
      <h2>Size</h2>
      <p className="muted">By the size of the hidden model.</p>
      <TraitTable kind="size" rows={report.sizes} />
      <h2>Region</h2>
      <p className="muted">By the region of the hidden model. Region found is a finished game where a guess got the region.</p>
      <TraitTable kind="region" rows={report.regions} />
    </>
  );
}

function CategoryMode({ categories }: { categories: CategoryStat[] }) {
  return (
    <>
      <h2>Category</h2>
      <p className="muted">
        By the categories of the hidden model. A round counts in each category that model belongs to. A model with no
        category is left out.
      </p>
      {categories.length === 0 ? <div className="card empty">No categories yet.</div> : <CategoryTable rows={categories} />}
    </>
  );
}

function gameFigures(outcome: Outcome): Figure[] {
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
    {
      label: "Region found",
      value: percent(outcome.regionFoundRate),
      note: "Finished games where a guess got the region",
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

function TraitTable({ kind, rows }: { kind: "size" | "region"; rows: TraitRow[] }) {
  return (
    <div className="card roster-card">
      <table className="roster compact">
        <thead>
          <tr>
            <th>{kind === "size" ? "Size" : "Region"}</th>
            <th>Games</th>
            <th>Solve rate</th>
            <th>Messages when solved</th>
            {kind === "region" ? <th>Region found</th> : null}
            <th>Tokens per game</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                {kind === "region" && row.key !== "unknown" ? (
                  <span className="roster-company">
                    <RegionFlag region={regionLabel(row.key as Region)} />
                    {traitLabel(kind, row.key)}
                  </span>
                ) : (
                  traitLabel(kind, row.key)
                )}
              </td>
              <td>{row.finished === 0 ? "0" : row.games.toLocaleString("en-US")}</td>
              <td>{row.finished === 0 ? "n/a" : percent(row.solveRate)}</td>
              <td>{decimal(row.avgMessagesWhenSolved)}</td>
              {kind === "region" ? <td>{row.finished === 0 ? "n/a" : percent(row.regionFoundRate)}</td> : null}
              <td>{compact(row.tokensPerGame)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function traitLabel(kind: "size" | "region", key: string): string {
  if (key === "unknown") return "Not recorded";
  if (kind === "size") return sizeLabel(key as Size);
  return regionLabel(key as Region);
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
