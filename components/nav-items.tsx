import type { ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode };

/** The six links, Play first. The header shows them inline; under 560px the Menu button next to the avatar lists them, after a Home link. */
export const navItems: NavItem[] = [
  {
    href: "/play",
    label: "Play",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 5.5v13a.8.8 0 0 0 1.2.7l10-6.5a.8.8 0 0 0 0-1.4l-10-6.5A.8.8 0 0 0 8 5.5z"
        />
      </svg>
    ),
  },
  {
    href: "/scoring",
    label: "Scoring",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11M9 8h6"
        />
      </svg>
    ),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4.5A2.5 2.5 0 0 0 7 9M17 6h2.5A2.5 2.5 0 0 1 17 9"
        />
      </svg>
    ),
  },
  {
    href: "/statistics",
    label: "Statistics",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M5 19V10M12 19V5M19 19v-7"
        />
      </svg>
    ),
  },
  {
    href: "/models",
    label: "Models",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM9 12v-1.5M15 12v-1.5M9 16h6"
        />
      </svg>
    ),
  },
  {
    href: "/why",
    label: "Why this game?",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M9.5 9.2a2.5 2.5 0 1 1 3.1 2.4c-.7.4-1.1.9-1.1 1.7V14"
        />
        <circle cx="12" cy="16.6" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];
