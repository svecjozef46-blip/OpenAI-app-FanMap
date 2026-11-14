import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for headlines: heavy, wide, upper-case — a sports-broadcast
// feel that is ours, set against the neutral Geist used for everything else.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["800"],
});

// Site-wide defaults; app/match/[matchId]/page.tsx overrides these per
// match via generateMetadata (see that file for why that matters).
export const metadata: Metadata = {
  title: {
    default: "Global Fan Map — The world is taking sides",
    template: "%s",
  },
  description: "Show which team you support and see which countries stand with you.",
  // Name used when the site is installed to a phone's home screen (see
  // app/manifest.ts). Icons and the manifest link are added by Next.js from
  // the files in app/ (favicon.ico, icon.svg, apple-icon.png, manifest.ts).
  applicationName: "Fanzo",
  appleWebApp: { capable: true, title: "Fanzo", statusBarStyle: "black-translucent" },
};

// Browser chrome (address bar on phones) matches the page in both modes.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Applies a stored light/dark choice BEFORE the first paint, so the page
// never flashes the wrong mode (Next.js guide "Preventing flash before
// hydration"). Without a stored choice nothing happens and CSS follows the
// device. Must stay in sync with THEME_STORAGE_KEY in lib/theme.ts.
const THEME_SCRIPT = `try{var t=localStorage.getItem("fanmap_theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script above may add data-theme to
    // <html> before React hydrates; that difference is intended.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex h-full flex-col overflow-hidden bg-bg text-fg">{children}</body>
    </html>
  );
}
