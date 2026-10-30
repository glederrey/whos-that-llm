"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";

/** Phone header: one menu button that lists the public links with their labels. Hidden above 560px by CSS. */
export function NavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="nav-menu" ref={rootRef}>
      <button
        type="button"
        className="nav-menu-button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M5 7h14M5 12h14M5 17h14" />
        </svg>
      </button>
      {open ? (
        <div className="menu" role="menu">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              role="menuitem"
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {item.icon}
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
