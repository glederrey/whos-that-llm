import { shareCardDisplay, shareText, type ShareCard } from "@/lib/share-card";

/** The public score card. Same facts as the PNG, not a copy of the result panel. */
export function ShareCardView({ card }: { card: ShareCard }) {
  const display = shareCardDisplay(card);
  return (
    <article className="share-card" aria-label={shareText(card)}>
      <div className="share-card-body">
        <div className="share-card-brand">
          <img src="/brand/logo-tail-right-light.png" alt="" />
          <strong>{display.title}</strong>
        </div>
        <p className="share-card-mode">
          <span>{display.mode}</span>
          {display.variant ? (
            <>
              <span className="share-card-dot">·</span>
              <span style={display.variantColor ? { color: display.variantColor } : undefined}>{display.variant}</span>
            </>
          ) : null}
        </p>
        <p className={display.score === "—" ? "share-card-score is-empty" : "share-card-score"}>{display.score}</p>
        <p className="share-card-outcome">{display.outcome}</p>
        {display.modelName ? <p className="share-card-model">{display.modelName}</p> : null}
        {display.details.length > 0 || display.hints ? (
          <div className="share-card-details">
            {display.details.map((line) => (
              <div key={line.label}>
                <span>{line.label}</span>
                <strong>{line.value}</strong>
              </div>
            ))}
            {display.hints ? (
              <div>
                <span>{display.hints}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="share-card-invite">
          <strong>{display.invite}</strong>
          <span>{display.site}</span>
        </p>
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
