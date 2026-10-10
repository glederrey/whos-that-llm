import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import { AccountMenu } from "@/components/account-menu";
import { SiteFooter } from "@/components/site-footer";
import { sessionIsOwner } from "@/lib/admin-access";
import { currentProfile } from "@/lib/session";
import "./globals.css";

const font = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font" });

export const metadata: Metadata = {
  title: "Who's that LLM?",
  description: "Ten messages to find the hidden model.",
  icons: { icon: "/brand/favicon.png" },
};

const themeScript = `(function(){try{var s=localStorage.getItem("theme");var t=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ user, username, avatarUrl }, owner] = await Promise.all([currentProfile(), sessionIsOwner()]);
  return (
    <html lang="en" className={font.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <div className="shell">
          <header className="header">
            <a className="brand" href="/">
              <img className="for-light" src="/brand/logo-tail-right-light.png" alt="" />
              <img className="for-dark" src="/brand/logo-tail-right-dark.png" alt="" />
              <span>Who&apos;s that LLM?</span>
            </a>
            <nav className="header-nav">
              <a href="/scoring">
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
                Scoring
              </a>
              <a href="/leaderboard">
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
                Leaderboard
              </a>
              <AccountMenu userId={user?.id ?? null} username={username} avatarUrl={avatarUrl}>
                {owner ? (
                  <a href="/admin" role="menuitem">
                    Admin
                  </a>
                ) : null}
              </AccountMenu>
            </nav>
          </header>
          <main className="page">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
