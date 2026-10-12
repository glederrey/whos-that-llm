export function RoundFacts({ mode, difficulty }: { mode: string; difficulty: string }) {
  return (
    <>
      <dt>Game mode</dt>
      <dd>{mode}</dd>
      <dt>Difficulty</dt>
      <dd>{difficulty}</dd>
    </>
  );
}

export function ResultSummary({ mode, difficulty }: { mode: string; difficulty: string }) {
  return (
    <dl className="summary-list">
      <RoundFacts mode={mode} difficulty={difficulty} />
    </dl>
  );
}
