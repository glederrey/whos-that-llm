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
      <p>A friend once told me:</p>
      <blockquote className="quote">
        <p>Over time I think I could tell an Opus 4.5 from a 4.7 and a 4.8. Like a wine...</p>
      </blockquote>
      <p>
        I laughed, and then I couldn&apos;t stop thinking about it. Can people actually tell models apart from just a few
        messages? Or do we only think we can?
      </p>
      <p>
        I&apos;m a data scientist, so my first instinct was to go and collect data. That&apos;s really what this game is
        for. Sure, it&apos;s fun to play, but every round also tells me something: which models get confused with each
        other, whether big models are easy to spot next to small ones, whether a model&apos;s origin shows through, and
        plenty of things I haven&apos;t thought of yet.
      </p>
      <p>
        I plan to share this data openly for research later on. Until then, the <a href="/statistics">statistics</a> page
        shows what we&apos;ve learned so far.
      </p>
      <h2>What I store</h2>
      <p>
        I keep your username and your game data: the messages, token counts, your guesses, which model you were talking
        to, and the other details of each round. That&apos;s it. I don&apos;t collect any other personal information. Sign
        in is handled by Supabase, so I never see or store your email or your password.
      </p>
    </div>
  );
}
