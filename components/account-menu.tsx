"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "./avatar";
import { navItems } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

export function AccountMenu({
  userId,
  username,
  avatarUrl,
  children,
}: {
  userId: string | null;
  username: string | null;
  avatarUrl: string | null;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState<"nav" | "account" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function signOutAccount() {
    await signOut();
    setOpen(null);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="account" ref={rootRef}>
      <button
        type="button"
        className="account-button account-burger"
        aria-expanded={open === "nav"}
        aria-label="Menu"
        onClick={() => setOpen((value) => (value === "nav" ? null : "nav"))}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M5 7h14M5 12h14M5 17h14" />
        </svg>
      </button>
      <button
        type="button"
        className="account-button account-avatar"
        aria-expanded={open === "account"}
        aria-label="Account"
        onClick={() => setOpen((value) => (value === "account" ? null : "account"))}
      >
        {userId ? <Avatar seed={userId} src={avatarUrl} /> : <GuestIcon />}
      </button>
      {open === "nav" ? (
        <div className="menu" role="menu">
          <a href="/" role="menuitem" aria-current={pathname === "/" ? "page" : undefined} onClick={() => setOpen(null)}>
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 11.5 12 4l8 7.5M6 10v10h4v-6h4v6h4V10"
              />
            </svg>
            Home
          </a>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              role="menuitem"
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={() => setOpen(null)}
            >
              {item.icon}
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
      {open === "account" ? (
        <div className="menu" role="menu">
          {username ? (
            <p className="menu-name">
              {userId ? <Avatar seed={userId} src={avatarUrl} size={28} /> : null}
              <span title={username}>{username}</span>
            </p>
          ) : null}
          {userId ? null : (
            <a href="/login" role="menuitem">
              Sign in
            </a>
          )}
          <ThemeToggle />
          {userId ? (
            <>
              {children}
              {username ? (
                <a href="/profile" role="menuitem">
                  Profile
                </a>
              ) : null}
              <div className="menu-rule" />
              <button type="button" className="menu-item" onClick={() => void signOutAccount()}>
                Sign out
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GuestIcon() {
  return (
    <svg className="guest-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19.2c1.4-3 4-4.5 7-4.5s5.6 1.5 7 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
