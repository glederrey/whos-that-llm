export function HomeCta({ signedIn, label = "Sign up", signedInLabel = "Try a round" }: { signedIn: boolean; label?: string; signedInLabel?: string }) {
  return (
    <div className="row">
      {signedIn ? (
        <a className="button button-lg" href="/play">
          {signedInLabel}
        </a>
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
