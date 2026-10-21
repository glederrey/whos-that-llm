import type { PublicGame } from "@/lib/game";
import { CompanyLogo } from "./company-logo";

export function GuessHistory({
  pastGuesses,
  noHint,
  freshGuessId,
}: {
  pastGuesses: PublicGame["pastGuesses"];
  noHint: boolean;
  freshGuessId: string | null;
}) {
  return (
    <section className="card guess-history">
      <h2>Previous guesses</h2>
      {pastGuesses.map((guess, index) => (
        <div key={guess.id} className={guess.id === freshGuessId ? "past-guess arrive" : "past-guess"}>
          <div className="past-model">
            <CompanyLogo src={guess.logoPath} />
            <span>
              {guess.companyName}
              <br />
              {guess.name}
            </span>
            <span className="past-message">Message {guess.message}</span>
          </div>
          {!noHint && index === 0 ? (
            <p className="wrong-line">
              {guess.wrong.length > 0 ? guess.wrong.map((trait) => `Wrong ${trait}`).join(" · ") : "Wrong model"}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
