"use client";

import { useEffect } from "react";
import { applyThemeColor } from "@/lib/theme-color";

const themeScript = `(function(){try{var s=localStorage.getItem("theme");var t=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`;

export function ThemeInit() {
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") applyThemeColor(stored);
    } catch {}
  }, []);
  return (
    <script
      id="theme-init"
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}
