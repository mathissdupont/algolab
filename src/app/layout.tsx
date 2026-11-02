import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "AlgoLab — design algorithms as runnable flowcharts",
  description: "Build an executable flowchart, step through every variable change, and test it before writing code.",
};

// Runs before paint so the saved/system theme never flashes.
const themeScript = `try{var t=localStorage.getItem('algolab:theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <header className="sticky top-0 z-30 h-14 border-b border-line bg-panel/90 backdrop-blur">
          <div className="mx-auto flex h-full max-w-[1600px] items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm font-bold text-white dark:text-[#0d0f13]">A</span>
              AlgoLab
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/problems/" className="hover:text-fg">
                Problems
              </Link>
              <Link href="/guide/" className="hover:text-fg">
                Guide
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
