import "server-only";
import { getActiveLeagues, getMatchTotals } from "@/lib/queries";
import type { League, MatchTotals, MatchWithTeams } from "@/lib/types";

// The data every match-screen page (/matches, /league/[slug],
// /match/[id]) needs besides its own match list: the leagues for the top
// navigation and vote totals for the match cards. One helper so the three
// pages can't drift apart.
export async function loadMatchScreenData(
  matches: MatchWithTeams[]
): Promise<{ leagues: League[]; totals: Record<string, MatchTotals> }> {
  const [leagues, totals] = await Promise.all([getActiveLeagues(), getMatchTotals(matches)]);
  return { leagues, totals };
}

// Default match to show: the featured one if present, else the first
// live match, else the soonest upcoming, else whatever comes first.
export function pickDefaultMatch(matches: MatchWithTeams[]): MatchWithTeams | undefined {
  return (
    matches.find((m) => m.is_featured) ??
    matches.find((m) => m.status === "live") ??
    matches.find((m) => m.status === "upcoming") ??
    matches[0]
  );
}
