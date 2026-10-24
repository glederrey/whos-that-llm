import type { Metadata } from "next";
import { config } from "@/lib/config";
import { SiteName } from "@/components/site-title";

export const metadata: Metadata = {
  description:
    "The reason for the game, the data a round stores, and who runs it. It asks whether people can tell language models apart.",
};

export default function WhyPage() {
  return (
    <div className="stack why">
      <a className="back" href="/">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
        </svg>
        Back
      </a>
      <h1>Why this game?</h1>
      <p>
        <SiteName tag="strong" /> started with something a friend said:
      </p>
      <blockquote className="quote">
        <p>“Over time I think I could tell an Opus 4.5 from a 4.7 and a 4.8. Like a wine...”</p>
      </blockquote>
      <p>
        I laughed, and then I couldn&apos;t stop thinking about it. Can people actually tell models apart from just a few
        messages? Especially models from the same family? Or do we only think we can?
      </p>
      <p>
        I&apos;m a data scientist, so my first instinct was to collect data. That&apos;s really what this game is for.
        Sure, it&apos;s fun to play, but every round also tells me something: which models get confused with each other,
        whether big models are easy to spot next to small ones, whether a model&apos;s origin shows through, and plenty of
        things I haven&apos;t thought of yet.
      </p>
      <p>
        I plan to share this data openly for research later on. Until then, the <a href="/statistics">statistics</a> page
        shows what the data says so far.
      </p>
      <h2>What data do I store?</h2>
      <p>
        I keep your username and your game data: the messages, token counts, your guesses, which model you were talking
        to, and the other details of each round. That&apos;s it. I don&apos;t collect any other personal information.
        Signing in is handled by Supabase, and by Google if you choose it. Your email is stored there only so you can
        log in, and I never use it for anything else. I never see your password.
      </p>
      <p>
        Your messages are sent to OpenRouter and to the company that runs the model you are talking to, so they can
        write the reply. Their own policies apply to what they receive. The site is hosted on Vercel, which also counts
        page views with Vercel Analytics. That count does not use cookies and is not tied to your account.
      </p>
      <p>
        You can delete your account at any time from your <a href="/profile">profile</a>. Your username comes off the
        leaderboard. Finished games stay in the statistics without your username.
      </p>
      <h2>Who am I?</h2>
      <p>
        I&apos;m Gael, a data scientist based in Fribourg, Switzerland, with a PhD from EPFL. Funny enough, my master
        thesis was about beer reviews: do people rate a beer for what it is, or because of what the community already
        said about it? So the wine comparison that started this game hit close to home. It&apos;s the same kind of
        question: can we really taste the difference, or do we just think we can?
      </p>
      <p>
        By the way, if you want to chat about the game, the data, or anything else, you can find me on{" "}
        <a href="https://www.linkedin.com/in/gael-lederrey" target="_blank" rel="noreferrer">
          LinkedIn
        </a>{" "}
        and{" "}
        <a href="https://github.com/glederrey" target="_blank" rel="noreferrer">
          GitHub
        </a>
        .
      </p>
      <h2>Do you want to contribute?</h2>
      <p>
        <SiteName tag="strong" /> is a small side project, and it gets better with help. If you have an idea,
        want to contribute, or found a bug, you&apos;re very welcome to{" "}
        <a href="https://github.com/glederrey/whos-that-llm/issues" target="_blank" rel="noreferrer">
          open an issue on GitHub
        </a>
        . Whether it&apos;s a typo or a big suggestion, I&apos;d love to hear about it.
      </p>
      <h2>Do you want to support the project?</h2>
      <p>
        I built this game on my own time, and I pay for the API calls myself. If you enjoy it and want to help keep it
        running, you can leave me a small tip on{" "}
        <a href={config.tipUrl} target="_blank" rel="noreferrer">
          Ko-fi
        </a>
        . It&apos;s completely optional, but it means a lot.
      </p>
    </div>
  );
}
