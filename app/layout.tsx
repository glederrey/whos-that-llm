import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { AccountMenu } from "@/components/account-menu";
import { navItems } from "@/components/nav-items";
import { SiteFooter } from "@/components/site-footer";
import { ThemeInit } from "@/components/theme-init";
import { sessionIsOwner } from "@/lib/admin-access";
import { currentProfile } from "@/lib/session";
import { SiteName, SiteTitle } from "@/components/site-title";
import { crawlableFavicons, siteOrigin } from "@/lib/site";
import "./globals.css";

// Latin Roboto, vendored so the standalone release build never resolves Google Fonts.
// The regular file covers 400, 500, and the site-wide 700 face. A separate bold
// cut is exposed as --font-bold for text that needs to look heavier.
const font = localFont({
  src: [
    { path: "./fonts/roboto-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/roboto-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/roboto-latin.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font",
});
const fontBold = localFont({
  src: "./fonts/roboto-latin-700.woff2",
  weight: "700",
  display: "swap",
  variable: "--font-bold",
});

// The status bar takes the page background, so it follows the OS color scheme like the canvas does.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e0e0e1" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  description:
    "A guessing game for AI fans. Chat with a hidden LLM for ten messages and guess which model it is. Daily rounds, several game modes, and a public leaderboard.",
  icons: {
    icon: [
      ...crawlableFavicons,
      { url: "/brand/favicon-light-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/favicon-light-96.png", sizes: "96x96", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/favicon-light-512.png", sizes: "512x512", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/favicon-dark-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/brand/favicon-dark-96.png", sizes: "96x96", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/brand/favicon-dark-512.png", sizes: "512x512", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ user, username, avatarUrl }, owner] = await Promise.all([currentProfile(), sessionIsOwner()]);
  return (
    <html lang="en" className={`${font.variable} ${fontBold.variable}`} suppressHydrationWarning>
      <head>
        <SiteTitle />
        <ThemeInit />
      </head>
      <body suppressHydrationWarning>
        <div className="shell">
          <header className="header">
            <a className="brand" href="/">
              <img className="for-light" width={56} height={56} src="/brand/logo-tail-right-light.png" alt="" />
              <img className="for-dark" width={56} height={56} src="/brand/logo-tail-right-dark.png" alt="" />
              <SiteName />
            </a>
            <nav className="header-nav">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} aria-label={item.label}>
                  {item.icon}
                  <span className="nav-label">{item.label}</span>
                </a>
              ))}
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
        <Analytics />
      </body>
    </html>
  );
}
