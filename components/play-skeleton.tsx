// Server component shared by the loading.tsx files under /play. It repeats the
// real layout (.round grid, .round-bar, .card) so nothing shifts when the page lands.
function Bars({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={`skeleton-bar${index === count - 1 ? " short" : ""}`} />
      ))}
    </>
  );
}

export function RoundSkeleton() {
  return (
    <div className="round" aria-busy="true">
      <p className="sr-only" role="status">
        Loading the round
      </p>
      <div className="thread">
        <div className="round-bar">
          <span className="skeleton-bar" style={{ width: 180 }} />
        </div>
        <div className="transcript" aria-hidden="true">
          <span className="skeleton-bubble" />
        </div>
        <div className="card" aria-hidden="true">
          <span className="skeleton-bar tall" style={{ display: "block" }} />
        </div>
      </div>
      <aside className="side" aria-hidden="true">
        <section className="card skeleton-card">
          <Bars count={3} />
        </section>
        <section className="card skeleton-card">
          <Bars count={3} />
          <span className="skeleton-bar tall" />
        </section>
      </aside>
    </div>
  );
}

export function ResultSkeleton() {
  return (
    <div className="stack result" aria-busy="true">
      <p className="sr-only" role="status">
        Loading the result
      </p>
      <section className="card skeleton-card" aria-hidden="true">
        <span className="skeleton-bar title" />
        <Bars count={3} />
      </section>
    </div>
  );
}

export function LobbySkeleton() {
  return (
    <div className="stack" aria-busy="true">
      <p className="sr-only" role="status">
        Loading
      </p>
      <section className="card skeleton-card" aria-hidden="true">
        <span className="skeleton-bar title" />
        <Bars count={2} />
        <span className="skeleton-bar tall" />
      </section>
    </div>
  );
}
