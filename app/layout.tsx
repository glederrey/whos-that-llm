import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const font = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font" });

export const metadata: Metadata = {
  title: "Who's that LLM",
  description: "Five messages. One hidden model. Name it.",
  icons: { icon: "/brand/favicon.png" },
};

const themeScript = `(function(){try{var s=localStorage.getItem("theme");var t=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <div className="shell">
          <header className="header">
            <a className="brand" href="/">
              <img className="for-light" src="/brand/logo-light.png" alt="" />
              <img className="for-dark" src="/brand/logo-dark.png" alt="" />
              <span>Who&apos;s that LLM</span>
            </a>
            <ThemeToggle />
          </header>
          <main className="page">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
