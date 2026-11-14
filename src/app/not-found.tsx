import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found — Global Fan Map" };

// Shown for any address that doesn't exist, and when a page calls
// notFound() (an unknown match or league, or a match that was archived).
// Follows light/dark mode like the rest of the site.
export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="font-display text-[clamp(4rem,14vw,8rem)] leading-none text-accent">404</p>
      <h1 className="font-display text-[clamp(1.6rem,4vw,2.5rem)] uppercase leading-none">Off the map</h1>
      <p className="max-w-sm text-muted">
        This match or page doesn&apos;t exist, or it&apos;s no longer available.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Back to the map
      </Link>
    </main>
  );
}
