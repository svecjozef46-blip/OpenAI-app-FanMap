import { connection } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { weekRange } from "@/lib/week";
import type { League, MatchResultRow, MatchTotals, MatchWithTeams } from "@/lib/types";

// Server-side data fetching for pages. When the database can't be reached
// these functions throw, and app/error.tsx shows visitors a friendly
// message with a retry button — rather than an empty list that looks like
// "no matches". (Vote counts are the exception: without them the page still
// works, so getMatchResultRows() falls back to "no votes".)
//
// Server-side data fetching for pages (app/page.tsx, app/match/[matchId]).
// Runs at request time on the server, which is also what makes correct
// per-match OG preview tags possible (generateMetadata in
// app/match/[matchId]/page.tsx reads the same data) — the whole reason
// tech-stack.md picked Next.js over Vite in the first place.

const MATCH_SELECT = `
  id, league_id, home_team_id, away_team_id, kickoff_at, status, is_featured, created_at,
  home_team:teams!matches_home_team_id_fkey(*),
  away_team:teams!matches_away_team_id_fkey(*),
  league:leagues!inner(id)
`;
// `league:leagues!inner(id)` is a filter, not data: visitors can only read
// ACTIVE leagues (RLS), so the inner join drops every match whose league is
// switched off. That hides US-sports fixtures before launch and the
// "Internal tests" league used by the automated tests (tests/README.md).

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

// The current match week (lib/week.ts). `connection()` tells Next.js this
// depends on the moment of the request, so it is never baked into a
// prerendered page (Next.js 16 refuses `new Date()` during prerendering).
export async function getCurrentWeek(): Promise<{ start: Date; end: Date }> {
  await connection();
  return weekRange(new Date());
}

// This week's matches (Monday to Sunday, Bratislava time — lib/week.ts),
// optionally limited to one league. Matches of earlier weeks are reachable
// only by their direct link, and next week's matches (often added in
// advance) stay hidden until their week starts — so an old round never
// mixes with a new one. Archived matches are hidden by RLS anyway.
// Matches are visible via RLS even if a team happens to be inactive
// (is_active only gates leagues/teams themselves) — fine for MVP scope.
export async function getVisibleMatches(leagueId?: string): Promise<MatchWithTeams[]> {
  const week = await getCurrentWeek();
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("matches")
    .select(MATCH_SELECT)
    .gte("kickoff_at", week.start.toISOString())
    .lt("kickoff_at", week.end.toISOString())
    .order("kickoff_at", { ascending: true });
  if (leagueId) query = query.eq("league_id", leagueId);
  const { data, error } = await query;

  if (error) throw new Error(`Failed to load matches: ${error.message}`);
  const matches = (data ?? []).map((row) => normalizeMatch(row as unknown as RawMatchRow));
  // What people can still vote on comes first: live, then upcoming (soonest
  // first), then finished matches (most recent first).
  const rank = (m: MatchWithTeams) => (m.status === "live" ? 0 : m.status === "upcoming" ? 1 : 2);
  return matches.sort((x, y) => {
    if (rank(x) !== rank(y)) return rank(x) - rank(y);
    const diff = new Date(x.kickoff_at).getTime() - new Date(y.kickoff_at).getTime();
    return rank(x) === 2 ? -diff : diff;
  });
}

// Kickoff of the first match after this week (optionally in one league),
// for the "next round starts …" line when this week has no matches. Only
// the date is shown, never next week's match list.
export async function getNextRoundKickoff(leagueId?: string): Promise<string | null> {
  const week = await getCurrentWeek();
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("matches")
    .select("kickoff_at, league:leagues!inner(id)")
    .gte("kickoff_at", week.end.toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1);
  if (leagueId) query = query.eq("league_id", leagueId);
  const { data, error } = await query;
  if (error) {
    // Only a nicety on an empty page — never worth an error screen.
    console.error("Failed to load next round:", error);
    return null;
  }
  return data?.[0]?.kickoff_at ?? null;
}

// Order of the league tabs in the top navigation: the big five domestic
// leagues first, the Champions League last (product owner's choice), then
// any league not listed here (e.g. one added later in /admin), A–Z.
const LEAGUE_ORDER = [
  "premier-league",
  "la-liga",
  "serie-a",
  "bundesliga",
  "ligue-1",
  "champions-league",
  "nfl",
  "nba",
  "mlb",
  "nhl",
  "mls",
];

// Active leagues for the top navigation (RLS hides inactive ones).
export async function getActiveLeagues(): Promise<League[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("leagues").select("*").order("name");
  if (error) throw new Error(`Failed to load leagues: ${error.message}`);
  const rank = (slug: string) => {
    const i = LEAGUE_ORDER.indexOf(slug);
    return i === -1 ? LEAGUE_ORDER.length : i;
  };
  return [...data].sort((a, b) => rank(a.slug) - rank(b.slug));
}

export async function getLeagueBySlug(slug: string): Promise<League | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("leagues").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Failed to load league: ${error.message}`);
  return data ?? null;
}

// Per-country vote rows for some matches, from the public match_results
// view (aggregated counts only — never raw votes).
export async function getMatchResultRows(matchIds: string[]): Promise<MatchResultRow[]> {
  if (matchIds.length === 0) return [];
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("match_results")
    .select("match_id, team_id, country_code, vote_count")
    .in("match_id", matchIds);
  if (error) {
    console.error("Failed to load match results:", error);
    return [];
  }
  return data as MatchResultRow[];
}

// Home/away vote totals per match, for match cards and "Trending".
export async function getMatchTotals(matches: MatchWithTeams[]): Promise<Record<string, MatchTotals>> {
  const rows = await getMatchResultRows(matches.map((m) => m.id));
  const totals: Record<string, MatchTotals> = {};
  for (const m of matches) totals[m.id] = { home: 0, away: 0 };
  for (const row of rows) {
    const match = matches.find((m) => m.id === row.match_id);
    if (!match) continue;
    if (row.team_id === match.home_team_id) totals[match.id].home += row.vote_count;
    else if (row.team_id === match.away_team_id) totals[match.id].away += row.vote_count;
  }
  return totals;
}

export async function getMatchById(matchId: string): Promise<MatchWithTeams | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", matchId)
    .maybeSingle();

  // A malformed id (not a UUID) is simply "no such match", not an outage.
  if (error && error.code !== "22P02") throw new Error(`Failed to load match: ${error.message}`);
  if (error || !data) return null;
  return normalizeMatch(data as unknown as RawMatchRow);
}
