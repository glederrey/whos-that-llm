export default function WhyPage() {
  return (
    <div className="stack">
      <a className="back" href="/">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
        </svg>
        Back
      </a>
      <h1>Why this game?</h1>
      <p>A friend said this:</p>
      <blockquote className="quote">
        <p>Over time I think I could tell an Opus 4.5 from a 4.7 and a 4.8. Like a wine...</p>
      </blockquote>
      <p>Gael thought it would be interesting to see if people can really tell models apart from a few messages.</p>
      <p>
        He is a data scientist. Playing gathers data on which models get confused with which: whether large models are easy
        to spot against small ones, whether region shows up, and so on. The aim is to share that data later for research.
        The <a href="/statistics">statistics</a> page is the public view of it.
      </p>
      <h2>What is stored</h2>
      <p>
        The site stores the username and the game data: messages, token counts, guesses, the model, and the rest of the
        round. It does not use other personal information. Sign-in goes through Supabase for security.
      </p>
    </div>
  );
}
