"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function preferred(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const next = preferred();
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }, []);

  function apply(next: Theme) {
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("theme", next);
    setTheme(next);
  }

  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="icon-button" onClick={() => apply(next)} aria-label={`Switch to ${next} theme`}>
      {next === "dark" ? "Dark" : "Light"}
    </button>
  );
}
