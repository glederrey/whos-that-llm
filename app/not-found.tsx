import type { Metadata } from "next";
import { MessageBubble } from "@/components/message-bubble";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="stack not-found">
      <p className="not-found-code">404</p>
      <h1>Who&apos;s that page?</h1>
      <p className="lede">Ten messages in, and we still can&apos;t find it.</p>
      <div className="transcript not-found-chat">
        <MessageBubble role="user" content="Which page are you?" />
        <MessageBubble
          role="assistant"
          content="Great question! I'm a large language model trained to be helpful, harmless, and honest. I'm also, I regret to say, not here."
        />
        <MessageBubble role="user" content="That sounds like exactly what a model would say." />
      </div>
      <div className="row">
        <a className="button" href="/">
          Back to the game
        </a>
        <a className="button-quiet" href="/leaderboard">
          See the leaderboard
        </a>
      </div>
    </div>
  );
}
