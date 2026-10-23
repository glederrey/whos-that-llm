import { OriginFlag } from "./origin-flag";

export function TraitLine({
  label,
  value,
  flag,
  reveal,
}: {
  label: string;
  value: string | null | undefined;
  flag?: boolean;
  reveal?: { label: string; busy: boolean; onOpen: () => void } | null;
}) {
  return (
    <p className={value ? "trait hit" : "trait"}>
      <span>{label}</span>
      <span className="trait-side">
        {value ? (
          <span className="trait-value">
            {flag ? <OriginFlag origin={value} /> : null}
            {value}
          </span>
        ) : (
          <span className="pill">Not found yet</span>
        )}
        {reveal && !value ? (
          <button type="button" className="button-quiet reveal" disabled={reveal.busy} onClick={reveal.onOpen}>
            {reveal.label}
          </button>
        ) : null}
      </span>
    </p>
  );
}
