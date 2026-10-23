export function OriginFlag({ origin }: { origin: string }) {
  if (origin === "USA") return <UsaFlag />;
  if (origin === "China") return <ChinaFlag />;
  if (origin === "Europe") return <EuropeFlag />;
  return null;
}

function UsaFlag() {
  return (
    <svg className="flag" viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#b22234" />
      <path stroke="#fff" strokeWidth="1.23" d="M0 1.23h24M0 3.69h24M0 6.15h24M0 8.62h24M0 11.08h24M0 13.54h24" />
      <rect width="10" height="8.6" fill="#3c3b6e" />
    </svg>
  );
}

function ChinaFlag() {
  return (
    <svg className="flag" viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#de2910" />
      <polygon fill="#ffde00" points="4,2.2 4.6,4 6.5,4 5,5.1 5.6,6.9 4,5.8 2.4,6.9 3,5.1 1.5,4 3.4,4" />
    </svg>
  );
}

function EuropeFlag() {
  return (
    <svg className="flag" viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#003399" />
      <g fill="#fc0">
        <circle cx="12" cy="3.2" r="0.7" />
        <circle cx="15.2" cy="4.2" r="0.7" />
        <circle cx="16.6" cy="7" r="0.7" />
        <circle cx="15.6" cy="10" r="0.7" />
        <circle cx="13.2" cy="11.6" r="0.7" />
        <circle cx="10.8" cy="11.6" r="0.7" />
        <circle cx="8.4" cy="10" r="0.7" />
        <circle cx="7.4" cy="7" r="0.7" />
        <circle cx="8.8" cy="4.2" r="0.7" />
      </g>
    </svg>
  );
}
