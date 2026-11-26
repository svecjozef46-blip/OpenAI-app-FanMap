"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { MatchTotals, MatchWithTeams } from "@/lib/types";
import { MatchCard } from "@/components/MatchCard";
import { MatchHeader } from "@/components/MatchHeader";
import { GlobalMap } from "@/components/GlobalMap";
import { MapInsights } from "@/components/MapInsights";
import { ShareBar } from "@/components/ShareBar";
import { useMatchResults } from "@/lib/useMatchResults";

// The match screen: match list + map. Owns `selectedMatchId` and nothing
// else; the user's votes live in lib/voter.ts (localStorage), so switching
// matches can never change or reset a vote.
//
// dev-prompt-chatgpt.md "MAP MATCH SWITCHING": selecting a match only
// changes props. GlobalMap, the header and the list are always rendered,
// never keyed by the selected match, so the Mapbox instance is never
// recreated. Votes are cast inside the match cards (MatchCard.tsx).
//
// Layout: desktop = sidebar | map (header and insights float over the
// map). Mobile = header, map, then the match list below, page scrolls.
//
// `pastMatchHref` switches to the single-match view used for a match from
// an earlier week (opened from an old shared link): just that match, its
// map and final result, no match list (old and new rounds never mix), and
// a button to this week's matches. No vote buttons exist in this view.
export function MatchExperience({
  title,
  matches,
  totals,
  initialSelectedMatchId,
  pastMatchHref,
}: {
  title: string;
  matches: MatchWithTeams[];
  totals: Record<string, MatchTotals>;
  initialSelectedMatchId: string;
  pastMatchHref?: string;
}) {
  const isSingle = pastMatchHref !== undefined;
  const [selectedMatchId, setSelectedMatchId] = useState(initialSelectedMatchId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // The scrolling container on phones (map on top, list below).
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? matches[0];
  const results = useMatchResults(selectedMatch);

  // Card totals come from the server render; the selected match's totals
  // are replaced with the live (polled) numbers so its card bar moves
  // together with the header right after a vote.
  const liveTotals = useMemo(() => {
    const next = { ...totals };
    if (results.length > 0) {
      next[selectedMatch.id] = {
        home: results.reduce((s, r) => s + r.homeVotes, 0),
        away: results.reduce((s, r) => s + r.awayVotes, 0),
      };
    }
    return next;
  }, [totals, results, selectedMatch.id]);

  // "Trending" = the match with the most votes (dev-prompt "TRENDING
  // MATCH": one subtle badge, not on every card).
  const trendingMatchId = useMemo(() => {
    let best: string | null = null;
    let bestTotal = 0;
    for (const [id, t] of Object.entries(liveTotals)) {
      if (t.home + t.away > bestTotal) {
        best = id;
        bestTotal = t.home + t.away;
      }
    }
    return best;
  }, [liveTotals]);

  // Selecting a match = navigation only. Also updates the address bar to
  // /match/{id} (without a page load), so refreshing or copying the URL
  // keeps the same match — acceptance tests #8 and #9.
  function selectMatch(matchId: string) {
    setSelectedMatchId(matchId);
    window.history.replaceState(null, "", `/match/${matchId}`);
    // On phones the list is below the map: bring the map back into view.
    if (scrollRef.current && scrollRef.current.scrollTop > 0) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollRef.current.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  const list = (
    <>
      <div className="flex items-baseline justify-between px-1 pb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted">
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {matches.map((match) => (
          <li key={match.id}>
            <MatchCard
              match={match}
              totals={liveTotals[match.id]}
              isSelected={match.id === selectedMatch.id}
              isTrending={match.id === trendingMatchId}
              onSelect={selectMatch}
            />
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div ref={scrollRef} className="flex h-full min-h-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      {/* Desktop sidebar */}
      {sidebarOpen && !isSingle && (
        <nav
          aria-label="Matches"
          className="hidden w-80 shrink-0 overflow-y-auto border-r border-line bg-bg p-3 md:block"
        >
          {list}
        </nav>
      )}

      <section className="relative flex min-w-0 flex-1 flex-col md:min-h-0" aria-label="Fan map">
        <div className="z-10 p-2 md:absolute md:inset-x-4 md:top-4 md:p-0">
          <div className="flex items-center gap-2">
            {!isSingle && (
              <button
                type="button"
                onClick={() => setSidebarOpen((open) => !open)}
                data-map-overlay="sidebar-button"
                className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-glass text-muted shadow-float backdrop-blur-xl transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-accent md:flex"
                aria-label={sidebarOpen ? "Hide match list" : "Show match list"}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? "‹" : "›"}
              </button>
            )}
            {/* Header stays compact and centred, so most of the map stays visible. */}
            <div className="mx-auto min-w-0 max-w-[720px] flex-1" data-map-overlay="header">
              <MatchHeader match={selectedMatch} results={results} forceClosed={isSingle} />
            </div>
            {/* Balances the sidebar toggle so the header stays centred. */}
            {!isSingle && <div className="hidden w-11 shrink-0 md:block" />}
          </div>
          {isSingle && (
            <div className="mt-2 flex justify-center">
              <Link
                href={pastMatchHref}
                className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg shadow-float transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                See this week&apos;s matches <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>

        {/* Phones: only as tall as the whole world is at this width — a taller
            box would make Mapbox zoom in and crop the continents. */}
        <div className="relative h-[calc(52vw+16px)] md:absolute md:inset-0 md:h-auto">
          <GlobalMap match={selectedMatch} results={results} />
          {/* Bottom overlay (desktop): insights on the left, share bar centred
              under the map (roughly below Africa on the world view). Kept
              above the Mapbox logo/attribution row. */}
          <div className="pointer-events-none absolute inset-x-3 bottom-9 hidden grid-cols-[1fr_auto_1fr] items-end gap-3 md:grid">
            <div className="pointer-events-auto justify-self-start" data-map-overlay="legend">
              <MapInsights match={selectedMatch} results={results} />
            </div>
            <div className="pointer-events-auto" data-map-overlay="share">
              <ShareBar match={selectedMatch} />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 p-3 md:hidden">
          <ShareBar match={selectedMatch} />
          <MapInsights match={selectedMatch} results={results} />
        </div>
      </section>

      {/* Mobile match list (below the map) */}
      {!isSingle && (
        <nav aria-label="Matches" className="border-t border-line p-3 md:hidden">
          {list}
        </nav>
      )}
    </div>
  );
}
