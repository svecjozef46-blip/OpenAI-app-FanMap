import type { Metadata } from "next";

// Every admin page reads the signed-in user's session cookie, which can't
// be part of a prerendered static shell. `instant = false` here (once, for
// the whole /admin tree) lets these pages render per request and block on
// the server — the same choice as the public pages, see app/page.tsx.
export const instant = false;

export const metadata: Metadata = {
  title: "Admin — Global Fan Map",
  // Keep the admin area out of search results.
  robots: { index: false, follow: false },
};

// The root layout locks the body to the viewport (overflow-hidden) for the
// full-screen map. Admin pages are normal long pages, so they get their own
// scroll container.
//
// The admin is always dark (`[color-scheme:dark]` + fixed colors): it's an
// internal tool styled with plain Tailwind greys, and keeping it out of the
// light/dark tokens means the public design can change without touching it.
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="h-full overflow-y-auto bg-zinc-950 text-zinc-100 [color-scheme:dark]">{children}</div>;
}
