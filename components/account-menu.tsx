"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "./avatar";
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
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
        aria-label={username ? username : "Account"}
        onClick={() => setOpen((value) => !value)}
      >
        {userId ? <Avatar seed={userId} src={avatarUrl} /> : <GuestIcon />}
      </button>
      {open ? (
        <div className="menu" role="menu">
          {username ? (
            <p className="menu-name">
              {userId ? <Avatar seed={userId} src={avatarUrl} size={28} /> : null}
              <span>{username}</span>
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
