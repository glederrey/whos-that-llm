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

  async function signOutAccount() {
    await signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="account" ref={rootRef}>
      <button
        type="button"
        className="account-button"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-face">{userId ? <Avatar seed={userId} src={avatarUrl} /> : <GuestIcon />}</span>
        <svg className="account-burger" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M5 7h14M5 12h14M5 17h14" />
        </svg>
      </button>
      {open ? (
        <div className="menu" role="menu">
          <a
            href="/"
            role="menuitem"
            className="menu-phone-only"
            aria-current={pathname === "/" ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
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
              className="menu-phone-only"
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {item.icon}
              {item.label}
            </a>
          ))}
          <div className="menu-rule menu-phone-only" />
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
