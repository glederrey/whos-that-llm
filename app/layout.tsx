import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Script from "next/script";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const font = DM_Sans({ subsets: ["latin"], variable: "--font" });

export const metadata: Metadata = {
  title: "Who's that LLM",
  description: "Five messages. One hidden model. Name it.",
  icons: { icon: "/brand/favicon.png" },
};

const themeScript = `(function(){try{var s=localStorage.getItem("theme");var t=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <div className="shell">
          <header className="header">
            <a className="brand" href="/">
              <img className="for-light" src="/brand/logo-dark.png" alt="Who's that LLM" />
              <img className="for-dark" src="/brand/logo-light.png" alt="" />
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
