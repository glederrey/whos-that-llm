export function HeroCta({ signedIn, label = "Play now" }: { signedIn: boolean; label?: string }) {
  return (
    <div className="row">
      {signedIn ? (
        <a className="button button-lg" href="/play">
          Start playing
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
