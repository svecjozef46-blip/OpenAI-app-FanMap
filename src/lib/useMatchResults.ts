"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { CountryResult, MatchResultRow, MatchWithTeams } from "@/lib/types";
import { buildCountryResults } from "@/lib/results";
import { VOTE_CAST_EVENT, type VoteCastEventDetail } from "@/lib/voteCastEvent";

// Real-time (Supabase Realtime / postgres_changes) isn't used here on
// purpose: the votes table has zero RLS policies for anon/authenticated
// (intentionally — see docs/decisions-log.md 2026-10-19), and Realtime
// change feeds are themselves RLS-gated, so the public client could never
// subscribe to vote changes even if we wanted it to. Polling is the
// pragmatic MVP stand-in; true live updates are Fáza 3 in
// docs/business-case.md and would need a different data path (e.g.
// broadcasting from the submit_vote() function), not just flipping this on.
const POLL_INTERVAL_MS = 15_000;

export function useMatchResults(match: MatchWithTeams): CountryResult[] {
  const [results, setResults] = useState<CountryResult[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchResults() {
      const { data, error } = await supabase
        .from("match_results")
        .select("match_id, team_id, country_code, vote_count")
        .eq("match_id", match.id);

      if (cancelled) return;
      if (error) {
        console.error("Failed to load match_results:", error);
        return;
      }
      setResults(buildCountryResults((data ?? []) as MatchResultRow[], match));
    }

    fetchResults();
    const intervalId = setInterval(fetchResults, POLL_INTERVAL_MS);

    function onVoteCast(event: Event) {
      const detail = (event as CustomEvent<VoteCastEventDetail>).detail;
      if (detail.matchId === match.id) {
        fetchResults();
      }
    }
    window.addEventListener(VOTE_CAST_EVENT, onVoteCast);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener(VOTE_CAST_EVENT, onVoteCast);
    };
    // match.home_team_id/away_team_id never change for a given match.id, so
    // match.id alone is the correct dependency — re-running this on every
    // new `match` object reference (e.g. from a parent re-render) would
    // restart polling unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  return results;
}
