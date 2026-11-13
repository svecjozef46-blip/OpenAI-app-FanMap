import "server-only";
import { requireAdmin } from "@/lib/admin/auth";
import type { League, MatchWithTeams, Team } from "@/lib/types";

// Admin-side reads. Unlike lib/queries.ts (public pages), these go through
// the signed-in admin's session, so RLS also returns inactive leagues/teams
// and archived matches. Each function calls requireAdmin() itself rather
// than taking a client as a parameter, so there's no way to call them
// without the admin check.

export async function getAllLeagues(): Promise<League[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("leagues").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function getLeague(id: string): Promise<League | null> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("leagues").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllTeams(): Promise<Team[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("teams").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function getTeam(id: string): Promise<Team | null> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("teams").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

const MATCH_SELECT = `
  *,
  home_team:teams!matches_home_team_id_fkey(*),
  away_team:teams!matches_away_team_id_fkey(*)
`;

// Newest kickoff first — in the admin the most recent/upcoming matches are
// the ones being edited.
export async function getAllMatches(): Promise<MatchWithTeams[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .order("kickoff_at", { ascending: false });
  if (error) throw error;
  return data as unknown as MatchWithTeams[];
}

export async function getMatch(id: string): Promise<MatchWithTeams | null> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as MatchWithTeams | null;
}
