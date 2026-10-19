import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MatchWithTeams } from "@/lib/types";

// Server-side data fetching for pages (app/page.tsx, app/match/[matchId]).
// Runs at request time on the server, which is also what makes correct
// per-match OG preview tags possible (generateMetadata in
// app/match/[matchId]/page.tsx reads the same data) — the whole reason
// tech-stack.md picked Next.js over Vite in the first place.

const MATCH_SELECT = `
  id, league_id, home_team_id, away_team_id, kickoff_at, status, is_featured, created_at,
  home_team:teams!matches_home_team_id_fkey(*),
  away_team:teams!matches_away_team_id_fkey(*)
`;

// Supabase's JS client types joined relations loosely; this narrows the
// query result back to MatchWithTeams in one place instead of casting at
// every call site.
type RawMatchRow = Omit<MatchWithTeams, "home_team" | "away_team"> & {
  home_team: MatchWithTeams["home_team"] | MatchWithTeams["home_team"][];
  away_team: MatchWithTeams["away_team"] | MatchWithTeams["away_team"][];
};

function normalizeMatch(row: RawMatchRow): MatchWithTeams {
  return {
    ...row,
    home_team: Array.isArray(row.home_team) ? row.home_team[0] : row.home_team,
    away_team: Array.isArray(row.away_team) ? row.away_team[0] : row.away_team,
  };
}

// Non-archived matches, newest kickoff first, for the home page and the
// match sidebar. Matches are visible via RLS even if a team happens to be
// inactive (is_active only gates leagues/teams themselves) — fine for MVP
// scope, revisit if a team gets deactivated mid-season.
export async function getVisibleMatches(): Promise<MatchWithTeams[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .order("kickoff_at", { ascending: true });

  if (error) {
    console.error("Failed to load matches:", error);
    return [];
  }
  return (data ?? []).map((row) => normalizeMatch(row as unknown as RawMatchRow));
}

export async function getMatchById(matchId: string): Promise<MatchWithTeams | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", matchId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("Failed to load match:", error);
    return null;
  }
  return normalizeMatch(data as unknown as RawMatchRow);
}
