import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlgoLab — design algorithms as runnable flowcharts",
  description: "Build an executable flowchart, step through every variable change, and test it before writing code.",
  appleWebApp: { capable: true, title: "AlgoLab", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

const navLink = "inline-flex h-11 items-center rounded-lg px-3 text-sm text-label-2 hover:text-label";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">
        <header className="sticky top-0 z-30 border-b border-separator bg-bg">
          <div className="flex h-14 items-center gap-2 px-2 sm:px-4">
            <Link href="/" className="inline-flex h-11 items-center rounded-lg px-2 text-[1.0625rem] font-semibold">
              AlgoLab
            </Link>
            <nav aria-label="Main" className="flex items-center">
              <Link href="/problems/" className={navLink}>
                Problems
              </Link>
              <Link href="/guide/" className={navLink}>
                Guide
              </Link>
            </nav>
            <a href="https://github.com/mathissdupont/algolab" className={`${navLink} ml-auto`} target="_blank" rel="noreferrer">
              Source
            </a>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
