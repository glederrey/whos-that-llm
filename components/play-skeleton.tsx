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
        <header aria-hidden="true">
          <div className="round-bar skeleton-bar-row">
            <span className="skeleton-bar" style={{ width: 180 }} />
          </div>
        </header>
        <div className="transcript" aria-hidden="true" />
        <div className="composer skeleton-composer" aria-hidden="true">
          <span className="skeleton-bar tall" />
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
      <span className="skeleton-bar skeleton-lockup" aria-hidden="true" />
      <span className="skeleton-bar skeleton-actions" aria-hidden="true" />
      <section className="card skeleton-card skeleton-score" aria-hidden="true">
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
      <div className="skeleton-lobby" aria-hidden="true">
        <span className="skeleton-bar title" />
        <span className="skeleton-bar skeleton-lede" />
        <span className="skeleton-bar skeleton-status" />
        <section className="card skeleton-card skeleton-modes">
          <Bars count={3} />
        </section>
      </div>
    </div>
  );
}
