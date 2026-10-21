import { useEffect, type RefObject } from "react";

// Sizes the previous-guesses card so the side column fits next to the thread.
export function useGuessFit(roundRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const round = roundRef.current;
    if (!round) return;
    const gap = 16;
    const stickyTop = 16;
    let frame = 0;
    let applied = "";
    const fit = () => {
      frame = 0;
      const side = round.querySelector<HTMLElement>(".side");
      const thread = round.querySelector<HTMLElement>(".thread");
      const history = side?.querySelector<HTMLElement>(".guess-history");
      if (!side || !thread || !history) return;
      if (window.matchMedia("(max-width: 899px)").matches) {
        history.style.removeProperty("--fit");
        history.style.maxHeight = "";
        applied = "";
        return;
      }
      const composer = thread.querySelector<HTMLElement>(".composer");
      const threadTop = thread.getBoundingClientRect().top;
      const top = Math.max(stickyTop, threadTop);
      const composerBottom = composer?.getBoundingClientRect().bottom ?? thread.getBoundingClientRect().bottom;
      // At the top of the page the card stops just above the window. Once the
      // writing box is on screen, the card ends level with it.
      const limit = Math.min(window.innerHeight - gap, composerBottom);
      const feedback = side.querySelector<HTMLElement>(".feedback");
      const guessBox = side.querySelector<HTMLElement>(".guess-box");
      let used = 0;
      if (feedback) used += feedback.offsetHeight + gap;
      if (guessBox) used += guessBox.offsetHeight + gap;
      const available = Math.max(0, Math.round(limit - top - used));
      const mark = `${available}:${history.childElementCount}`;
      if (mark === applied) return;
      side.style.maxHeight = "none";
      history.style.maxHeight = "none";
      history.style.setProperty("--fit", "1");
      const natural = history.offsetHeight;
      side.style.maxHeight = "";
      if (natural <= available) {
        history.style.maxHeight = "";
        applied = mark;
        return;
      }
      history.style.maxHeight = `${available}px`;
      let low = 0.3;
      let high = 1;
      let best = low;
      for (let step = 0; step < 6; step += 1) {
        const mid = (low + high) / 2;
        history.style.setProperty("--fit", mid.toFixed(3));
        if (history.scrollHeight <= history.clientHeight + 1) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      }
      history.style.setProperty("--fit", best.toFixed(3));
      applied = mark;
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(fit);
    };
    fit();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    const watched = round.querySelector(".side");
    const thread = round.querySelector(".thread");
    const composer = thread?.querySelector(".composer");
    const feedback = watched?.querySelector(".feedback");
    const guessBox = watched?.querySelector(".guess-box");
    if (thread) observer.observe(thread);
    if (composer) observer.observe(composer);
    if (feedback) observer.observe(feedback);
    if (guessBox) observer.observe(guessBox);
    const mutations = new MutationObserver(() => {
      applied = "";
      schedule();
    });
    if (watched) mutations.observe(watched, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      mutations.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      const history = round.querySelector<HTMLElement>(".guess-history");
      history?.style.removeProperty("--fit");
      if (history) history.style.maxHeight = "";
    };
  }, [roundRef]);
}
