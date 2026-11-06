/**
 * Calls `onIdle` once when `touch()` has not been called for `idleMs`. Until the first touch the wait
 * is `firstMs`, because a model can take a while to send its first chunk. `stop()` cancels it.
 * Call `touch()` on every chunk of any kind, reasoning included.
 */
export function createIdleWatch(options: { firstMs: number; idleMs: number; onIdle: () => void }) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let done = false;

  function arm(ms: number) {
    if (done) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      done = true;
      timer = null;
      options.onIdle();
    }, ms);
  }

  arm(options.firstMs);

  return {
    touch() {
      arm(options.idleMs);
    },
    stop() {
      done = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
