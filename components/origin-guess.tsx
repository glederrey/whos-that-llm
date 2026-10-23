import { Twemoji } from "@/components/twemoji";
import type { OriginChoice } from "@/lib/game";

/** The left block of an Origin score card: the guess, and the real origin when the guess missed or the player gave up. */
export function OriginGuess({
  label,
  guessed,
  actual,
  correct,
}: {
  label: string;
  guessed: OriginChoice | null;
  actual: OriginChoice;
  correct: boolean;
}) {
  return (
    <div className="origin-guess">
      <p className="score-label">{label}</p>
      <p className="score origin-pick">
        {guessed ? (
          <>
            <Twemoji emoji={guessed.flag} /> {guessed.name}
          </>
        ) : (
          "—"
        )}
      </p>
      {correct ? null : (
        <p className="origin-actual">
          <span className="score-label">Comes from</span>
          <strong>
            <Twemoji emoji={actual.flag} /> {actual.name}
          </strong>
        </p>
      )}
    </div>
  );
}
