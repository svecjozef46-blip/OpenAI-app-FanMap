"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

// Shown when a page fails to load its data (e.g. the database can't be
// reached). Visitors get a plain explanation and a way forward; the
// technical details go to the console for whoever is debugging.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="font-display text-[clamp(1.6rem,4vw,2.5rem)] uppercase leading-none">
        We couldn&apos;t load the matches
      </h1>
      <p className="max-w-sm text-muted">
        Something went wrong on our side or with your connection. Your votes are safe — please try again in a moment.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try again
        </button>
        <Link href="/" className="text-sm font-medium hover:text-accent">
          Back to the map <span aria-hidden="true">→</span>
        </Link>
      </div>
    </main>
  );
}
