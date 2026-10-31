import type { Metadata } from "next";
import { HeroCta } from "@/components/hero-cta";
import { currentProfile } from "@/lib/session";
import { landingSnapshot } from "@/lib/rounds";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hero preview", robots: { index: false, follow: false } };
import { Avatar } from "@/components/avatar";
import { CountUp } from "@/components/hero-demos";
import { boardChoice, boardModes, boardPool } from "@/lib/board-query";
import { leaderboard, listGameModes } from "@/lib/rounds";

/** Idea 2: a challenge. The real top three, and a number to beat. */
export default async function Hero2() {
  const { user, username } = await currentProfile();
  const [snapshot, gameModes] = await Promise.all([landingSnapshot(), listGameModes()]);
  const choice = boardChoice({}, boardModes(gameModes));
  const board = await leaderboard(choice.gameMode, choice.period, user?.id, choice.difficulty, boardPool({ ...choice, company: "all", category: "all" }));
  const top = "rows" in board ? board.rows.slice(0, 3) : [];
  const best = top[0]?.score ?? 0;
  return (
    <div className="stack landing">
      <section className="h2-hero">
        <p className="h2-kicker">The leaderboard</p>
        <h1>{best > 0 ? <>Think you can beat <span className="h2-num"><CountUp to={best} /></span>?</> : "Be the first on the board."}</h1>
        <p className="h2-sub">One hidden AI, ten messages, one guess. Fewer messages and fewer hints score more.</p>
        {top.length > 0 ? (
          <ol className="h2-podium">
            {top.map((row, index) => (
              <li key={row.rank} style={{ animationDelay: `${index * 140}ms` }} data-rank={row.rank}>
                <span className="h2-rank">{row.rank}</span>
                <Avatar seed={row.seed ?? row.name} src={row.avatarUrl} size={44} />
                <span className="h2-name">{row.name}</span>
                <span className="h2-score"><CountUp to={row.score} /></span>
              </li>
            ))}
          </ol>
        ) : null}
        <HeroCta signedIn={Boolean(user && username)} label="Take the challenge" />
        <p className="h2-proof">
          {snapshot.gamesToday.toLocaleString("en-US")} games today · {snapshot.players.toLocaleString("en-US")} players
        </p>
      </section>
    </div>
  );
}
