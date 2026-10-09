import { redirect } from "next/navigation";
import { ResetPassword } from "@/components/reset-password";
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
  const signedIn = Boolean(user && username);

  return (
    <div className="stack">
      {resetting && user ? <ResetPassword hasUsername={Boolean(username)} /> : null}
      <section className="hero">
        <img className="hero-logo for-light" src="/brand/logo-light.png" alt="" />
        <img className="hero-logo for-dark" src="/brand/logo-dark.png" alt="" />
        <div className="stack">
          <h1>Find the model.</h1>
          <p>
            A hidden model answers you. You have five messages. After each reply, name the one you think it is. Find it, and
            the round is yours. Miss the name, and the company and the region can still count.
          </p>
          <div className="row">
            {signedIn ? (
              <a className="button" href="/play">
                Play
              </a>
            ) : (
              <>
                <a className="button" href="/login?tab=create&next=/play">
                  Sign up
                </a>
                <a className="button-quiet" href="/login?next=/play">
                  Sign in
                </a>
              </>
            )}
          </div>
          <p className="muted">The leaderboard is open to everyone. An account is only for playing.</p>
        </div>
      </section>
    </div>
  );
}
