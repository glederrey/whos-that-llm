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

export function ResultSummary({
  mode,
  difficulty,
  noHint = false,
}: {
  mode: string;
  difficulty: string;
  noHint?: boolean;
}) {
  return (
    <dl className="summary-list">
      <RoundFacts mode={mode} difficulty={difficulty} />
      {noHint ? (
        <>
          <dt>Hints</dt>
          <dd>No hints</dd>
        </>
      ) : null}
    </dl>
  );
}
