"use client";

import { useState } from "react";
import type { MatchWithTeams } from "@/lib/types";
import { useClientValue } from "@/lib/useClientValue";

// dev-prompt-chatgpt.md "SHARING": each match has a shareable URL
// (/match/{matchId}), X/Twitter, Facebook, Reddit, Copy Link, and native
// Web Share API on supported mobile. This whole feature only exists
// because the viral loop depends on it — see docs/business-case.md: the
// product's growth plan assumes people share match links, not that they
// find the site some other way.
export function ShareSection({ match }: { match: MatchWithTeams }) {
  const [copied, setCopied] = useState(false);
  // Checking navigator.share() directly in render would mismatch between
  // server HTML (no `navigator`) and the client's first paint — same class
  // of bug as the localStorage read in lib/voter.ts. useClientValue (built
  // on useSyncExternalStore) is the React-documented fix.
  const canNativeShare = useClientValue(
    () => typeof navigator !== "undefined" && "share" in navigator,
    false
  );

  // Resolved client-side (window.location.origin), not from an env var, so
  // share links are correct in every environment (preview deploys,
  // localhost, production) without per-environment config. Same
  // hydration-safety reasoning as canNativeShare above.
  const url = useClientValue(
    () => `${window.location.origin}/match/${match.id}`,
    `/match/${match.id}`
  );
  const text = `${match.home_team.name} vs ${match.away_team.name} — who does the world support? See the live Global Fan Map.`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Global Fan Map", text, url });
      } catch {
        // User cancelled the native share sheet — not an error.
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
      <span className="text-zinc-500">Share:</span>
      <a
        className="rounded-full bg-white/5 px-3 py-1.5 text-zinc-300 hover:bg-white/10"
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        X
      </a>
      <a
        className="rounded-full bg-white/5 px-3 py-1.5 text-zinc-300 hover:bg-white/10"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Facebook
      </a>
      <a
        className="rounded-full bg-white/5 px-3 py-1.5 text-zinc-300 hover:bg-white/10"
        href={`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Reddit
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-full bg-white/5 px-3 py-1.5 text-zinc-300 hover:bg-white/10"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      {canNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          className="rounded-full bg-white/5 px-3 py-1.5 text-zinc-300 hover:bg-white/10 sm:hidden"
        >
          Share…
        </button>
      )}
    </div>
  );
}
