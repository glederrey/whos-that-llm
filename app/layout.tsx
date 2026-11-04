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
import { crawlableFavicons, homeDescription, siteOrigin, socialMetadata } from "@/lib/site";
import "./globals.css";

// Latin faces, vendored so the standalone release build never resolves Google Fonts (all OFL).
// Instrument Sans is the text face; --font-bold keeps its name for text that needs to look heavier.
// Lato sets titles and the score; JetBrains Mono sets counters and labels.
const font = localFont({
  src: "./fonts/instrument-sans-latin.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font",
});
const fontBold = localFont({
  src: "./fonts/instrument-sans-latin.woff2",
  weight: "700",
  display: "swap",
  variable: "--font-bold",
});
const fontDisplay = localFont({
  src: [
    { path: "./fonts/lato-latin-700.woff2", weight: "700" },
    { path: "./fonts/lato-latin-900.woff2", weight: "900" },
  ],
  display: "swap",
  variable: "--font-display",
});
const fontMono = localFont({
  src: "./fonts/jetbrains-mono-latin-500.woff2",
  weight: "500",
  display: "swap",
  variable: "--font-mono",
});

// The status bar takes the page background, so it follows the OS color scheme like the canvas does.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ebebeb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  ...socialMetadata(homeDescription),
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
    <html lang="en" className={`${font.variable} ${fontBold.variable} ${fontDisplay.variable} ${fontMono.variable}`} suppressHydrationWarning>
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
