import Link from "next/link";

export function HomeCta({ signedIn, label = "Sign up", signedInLabel = "Try a round" }: { signedIn: boolean; label?: string; signedInLabel?: string }) {
  return (
    <div className="row">
      {signedIn ? (
        <Link className="button button-lg" href="/play">
          {signedInLabel}
        </Link>
      ) : (
        <>
          <a className="button button-lg" href="/login?tab=create&next=/play">
            {label}
          </a>
          <a className="button-quiet button-lg" href="/login?next=/play">
            Sign in
          </a>
        </>
      )}
    </div>
  );
}
