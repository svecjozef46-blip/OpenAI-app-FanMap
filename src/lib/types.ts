// Shared data types, mirroring the Supabase schema (see docs/idea.md and the
// migrations applied directly via the Supabase MCP connection — this project
// has no supabase/migrations folder yet; the schema lives in the database
// itself, documented in docs/decisions-log.md 2026-10-19).

export type League = {
  id: string;
  name: string;
  slug: string;
  sport: string;
  is_active: boolean;
  created_at: string;
};

export type Team = {
  id: string;
  league_id: string;
  name: string;
  short_name: string;
  primary_color: string;
  secondary_color: string;
  // Intentionally null for real clubs for now — see docs/idea.md
  // "trademark caution": official crests need a license we don't have.
  // The UI falls back to name + colors (see TeamBadge.tsx) whenever this
  // is null, which today means always.
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type MatchStatus = "upcoming" | "live" | "finished" | "archived";

export type Match = {
  id: string;
  league_id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  status: MatchStatus;
  is_featured: boolean;
  created_at: string;
};

// A match with its teams already joined in — what the UI actually renders.
export type MatchWithTeams = Match & {
  home_team: Team;
  away_team: Team;
};

// One row per (team, country) pair for a match, from the public
// `match_results` view (aggregated — never raw vote rows; see
// docs/decisions-log.md 2026-10-19 for why that view exists).
export type MatchResultRow = {
  match_id: string;
  team_id: string;
  country_code: string;
  vote_count: number;
};

// Per-country roll-up the map actually consumes: which team leads in this
// country for this match, and by how much.
export type CountryResult = {
  countryCode: string;
  homeVotes: number;
  awayVotes: number;
  totalVotes: number;
  // null = not enough votes yet to call it either way, or a genuine tie.
  // See MIN_VOTES_TO_COLOR in lib/mapConfig.ts.
  leadingTeamId: string | null;
};
