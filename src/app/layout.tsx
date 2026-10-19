import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Site-wide defaults; app/match/[matchId]/page.tsx overrides these per
// match via generateMetadata (see that file for why that matters).
export const metadata: Metadata = {
  title: {
    default: "Global Fan Map",
    template: "%s",
  },
  description: "See which countries support your club.",
};

// Dark-only for now, matching the "premium dark" direction in
// docs/tech-stack.md ("Mapbox dark-v11 štýl dáva premium vzhľad"). A
// light/system theme toggle is in dev-prompt-chatgpt.md "THEME" but wasn't
// built for this pass — the whole visual design (team colors against the
// map, the header, every component here) was built and tuned against one
// dark background, and a toggle needs a second pass through all of them,
// not just a CSS variable flip. Tracked as a follow-up, not dropped
// silently.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="flex h-full flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
