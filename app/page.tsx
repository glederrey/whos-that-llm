import { redirect } from "next/navigation";
import { ResetPassword } from "@/components/reset-password";
import { listCategories } from "@/lib/rounds";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const params = await searchParams;
  if (params.error === "access_denied") redirect("/login?error=cancelled");
  const { user, username } = await currentProfile();
  const resetting = params.reset === "1";
  if (user && !username && !resetting) redirect("/welcome");
  const categories = await listCategories();
  const playHref = user ? (username ? "/play" : "/welcome") : "/login";

  return (
    <div className="stack">
      {resetting && user ? <ResetPassword hasUsername={Boolean(username)} /> : null}
      <h1>Who&apos;s that LLM</h1>
      <p className="lede">Five messages. One hidden model. Name it.</p>
      <p className="limits">5 messages · 1 guess each · 10 games an hour</p>
      <div className="row">
        <a className="button" href={playHref}>
          Play
        </a>
        <a className="button-quiet" href="/leaderboard">
          Leaderboard
        </a>
      </div>
      <div className="card category-list">
        {categories.map((category) => (
          <div key={category.id}>
            <span>
              <strong>{category.name}</strong>
              <br />
              <span className="muted">{category.blurb}</span>
            </span>
            {category.enabled ? null : <span className="pill">Not open yet</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
