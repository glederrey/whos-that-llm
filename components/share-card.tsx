import { shareCardDisplay, shareText, type ShareCard } from "@/lib/share-card";

/** The on-page score card. Same facts as the PNG, not a copy of the result panel. */
export function ShareCardView({ card }: { card: ShareCard }) {
  const display = shareCardDisplay(card);
  return (
    <article className="share-card" aria-label={shareText(card)}>
      <div className="share-card-bar" />
      <div className="share-card-body">
        <div className="share-card-brand">
          <img src="/brand/logo-tail-right-light.png" alt="" />
          <strong>{display.title}</strong>
        </div>
        <p className="share-card-mode">
          <span>{display.mode}</span>
          {display.variant ? (
            <span style={display.variantColor ? { color: display.variantColor } : undefined}>{` · ${display.variant}`}</span>
          ) : null}
        </p>
        <p className={display.score === "—" ? "share-card-score is-empty" : "share-card-score"}>{display.score}</p>
        <p className="share-card-outcome">{display.outcome}</p>
        {display.modelName ? <p className="share-card-model">{display.modelName}</p> : null}
        <div className="share-card-stats">
          <div>
            <span>{display.messagesLabel}</span>
            <strong>{display.messages}</strong>
          </div>
          <div>
            <span>{display.tokensLabel}</span>
            <strong>{display.tokens}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}
