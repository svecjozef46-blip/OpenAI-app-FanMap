"use client";

import { useState } from "react";
import type { MatchWithTeams } from "@/lib/types";
import { useClientValue } from "@/lib/useClientValue";

// dev-prompt-chatgpt.md "SHARING": shareable URL /match/{id}, named social
// networks, Copy link, and the native share sheet on phones. Sits at the
// bottom of the map (under Africa on the world view) so it's visible
// without covering the interesting part. The viral loop in
// docs/business-case.md depends on people sharing match links.
export function ShareBar({ match }: { match: MatchWithTeams }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  // navigator/window don't exist on the server — useClientValue avoids a
  // hydration mismatch (same reasoning as lib/voter.ts).
  const canNativeShare = useClientValue(
    () => typeof navigator !== "undefined" && "share" in navigator,
    false
  );
  const url = useClientValue(
    () => `${window.location.origin}/match/${match.id}`,
    `/match/${match.id}`
  );
  const text = `${match.home_team.name} vs ${match.away_team.name}: which countries support which team? Show who you support on the Global Fan Map.`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      // Clipboard can be blocked (permissions, non-HTTPS) — say so instead
      // of pretending it worked.
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 2000);
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title: "Global Fan Map", text, url });
    } catch {
      // User closed the share sheet — not an error.
    }
  }

  const networks = [
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
    { label: "Reddit", href: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}` },
  ];

  const pill =
    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400";

  return (
    <div className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-zinc-950/75 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <span className="shrink-0 pl-2.5 pr-1 text-xs text-zinc-500">Share</span>
      {canNativeShare && (
        <button type="button" onClick={handleNativeShare} className={`${pill} sm:hidden`}>
          Share…
        </button>
      )}
      {networks.map((n) => (
        <a key={n.label} href={n.href} target="_blank" rel="noopener noreferrer" className={pill}>
          {n.label}
        </a>
      ))}
      <button
        type="button"
        onClick={handleCopy}
        aria-live="polite"
        className={`${pill} ${copyState === "copied" ? "text-emerald-400" : ""}`}
      >
        {copyState === "copied" ? "Link copied ✓" : copyState === "failed" ? "Copy failed" : "Copy link"}
      </button>
    </div>
  );
}
