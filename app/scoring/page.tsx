export const dynamic = "force-dynamic";

export default function ScoringPage() {
  return (
    <div className="stack narrow">
      <a className="back" href="/">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
        </svg>
        Back
      </a>
      <h1>How scoring works</h1>
      <p>A round starts from a base, then the chat stretches or shrinks it.</p>
      <ul>
        <li>Naming the model sets the base to 1,000. Region and company do not add on top of that.</li>
        <li>If you never name it, a matching region is 100 and a matching company is 300. A trait the round already showed you adds nothing.</li>
        <li>Tokens: 1,000 divided by the tokens the replies used. Fewer tokens score higher. Zero tokens counts as 1, so the math never divides by zero.</li>
        <li>Messages: 10 divided by the replies you used. The first reply is ×10. The tenth is ×1.</li>
        <li>No-hint play multiplies by 1.5.</li>
        <li>Each hint you buy, year or size, subtracts 100 after those multipliers.</li>
        <li>Each wrong model subtracts 50, also after the multipliers. Naming the right model does not take that 50. Earlier wrong names still do, even if you solve the round later.</li>
      </ul>
      <p>The total can be negative. The result page shows that number.</p>
      <h2>One round</h2>
      <p>
        Two replies used 500 tokens. The first name was wrong. You bought the year. The second name was the model.
      </p>
      <pre className="formula">{`base  = 1000
score = round(1000 × (1000 / 500) × (10 / 2)) − 100 − 50
      = round(1000 × 2 × 5) − 150
      = 9,850`}</pre>
      <p className="muted">Your own result page still lists the lines for that round.</p>
    </div>
  );
}
