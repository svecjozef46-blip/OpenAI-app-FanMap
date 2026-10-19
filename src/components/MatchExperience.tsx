"use client";

import { useMemo, useState } from "react";
import type { MatchWithTeams } from "@/lib/types";
import { MatchSidebar } from "@/components/MatchSidebar";
import { MatchHeader } from "@/components/MatchHeader";
import { GlobalMap } from "@/components/GlobalMap";
import { ShareSection } from "@/components/ShareSection";
import { useMatchResults } from "@/lib/useMatchResults";

// The single owner of `selectedMatchId`. Per dev-prompt-chatgpt.md "MAP
// MATCH SWITCHING": changing it must only update the map's data and the
// header, never remount MatchSidebar or GlobalMap — which is exactly what
// happens here, since both are rendered unconditionally below and only
// receive new props on selection change. See MatchRow.tsx and
// GlobalMap.tsx for the two halves of that guarantee.
export function MatchExperience({
  matches,
  initialSelectedMatchId,
}: {
  matches: MatchWithTeams[];
  initialSelectedMatchId: string;
}) {
  const [selectedMatchId, setSelectedMatchId] = useState(initialSelectedMatchId);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === selectedMatchId) ?? matches[0],
    [matches, selectedMatchId]
  );

  const results = useMatchResults(selectedMatch);

  if (!selectedMatch) {
    return <p className="p-6 text-zinc-400">No matches available yet.</p>;
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      {sidebarOpen && (
        <MatchSidebar
          matches={matches}
          selectedMatchId={selectedMatch.id}
          onViewMap={setSelectedMatchId}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-white/10 bg-zinc-950/60">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="m-2 shrink-0 rounded-md p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            aria-label={sidebarOpen ? "Hide match list" : "Show match list"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? "⟨" : "⟩"}
          </button>
          <div className="min-w-0 flex-1">
            <MatchHeader match={selectedMatch} results={results} />
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <GlobalMap match={selectedMatch} results={results} />
        </div>
        <div className="border-t border-white/10 bg-zinc-950/60">
          <ShareSection match={selectedMatch} />
        </div>
      </div>
    </div>
  );
}
