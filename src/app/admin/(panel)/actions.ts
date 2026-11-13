"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import {
  HEX_COLOR_RE,
  UUID_RE,
  describeDbError,
  getBoolean,
  getString,
  slugify,
  utcInputToIso,
  type ActionState,
} from "@/lib/admin/form";
import type { MatchStatus } from "@/lib/types";

// All admin writes. Each action:
//   1. calls requireAdmin() first (Server Actions are public endpoints —
//      never rely on the page that rendered the form being protected),
//   2. validates the form input and returns a readable error if it's off,
//   3. writes through the admin's own session (RLS checks is_admin() again),
//   4. refreshes the affected pages and redirects back to the list.
//
// `id` is bound by the edit page (`saveX.bind(null, id)`); null = create.
// There are no delete actions on purpose — see docs/schema.sql "ADMIN".

// Public pages that show league/team/match data.
function revalidatePublicPages() {
  revalidatePath("/", "layout");
}

// LEAGUES ---------------------------------------------------------------------

const SPORTS = ["football", "american_football", "basketball", "baseball", "ice_hockey"];

export async function saveLeague(
  id: string | null,
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireAdmin();

  const name = getString(formData, "name");
  const slug = slugify(getString(formData, "slug") || name);
  const sport = getString(formData, "sport");
  const isActive = getBoolean(formData, "is_active");

  if (!name) return { error: "Name is required." };
  if (!slug) return { error: "Slug is required." };
  if (!SPORTS.includes(sport)) return { error: "Pick a sport." };

  const values = { name, slug, sport, is_active: isActive };
  const { error } = id
    ? await supabase.from("leagues").update(values).eq("id", id)
    : await supabase.from("leagues").insert(values);
  if (error) return { error: describeDbError(error) };

  revalidatePublicPages();
  redirect("/admin/leagues");
}

// TEAMS -----------------------------------------------------------------------

export async function saveTeam(
  id: string | null,
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireAdmin();

  const leagueId = getString(formData, "league_id");
  const name = getString(formData, "name");
  const shortName = getString(formData, "short_name").toUpperCase();
  const primaryColor = getString(formData, "primary_color");
  const secondaryColor = getString(formData, "secondary_color");
  const isActive = getBoolean(formData, "is_active");

  if (!UUID_RE.test(leagueId)) return { error: "Pick a league." };
  if (!name) return { error: "Name is required." };
  if (!shortName || shortName.length > 4) {
    return { error: "Short name is required, max 4 characters (e.g. LIV)." };
  }
  if (!HEX_COLOR_RE.test(primaryColor) || !HEX_COLOR_RE.test(secondaryColor)) {
    return { error: "Colors must be hex values like #C8102E." };
  }

  // logo_url is intentionally not editable here and never set: no official
  // club crests without a license (docs/idea.md "trademark caution").
  const values = {
    league_id: leagueId,
    name,
    short_name: shortName,
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    is_active: isActive,
  };
  const { error } = id
    ? await supabase.from("teams").update(values).eq("id", id)
    : await supabase.from("teams").insert(values);
  if (error) return { error: describeDbError(error) };

  revalidatePublicPages();
  redirect("/admin/teams");
}

// MATCHES ---------------------------------------------------------------------

const STATUSES: MatchStatus[] = ["upcoming", "live", "finished", "archived"];

export async function saveMatch(
  id: string | null,
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireAdmin();

  const leagueId = getString(formData, "league_id");
  const homeTeamId = getString(formData, "home_team_id");
  const awayTeamId = getString(formData, "away_team_id");
  const kickoffAt = utcInputToIso(getString(formData, "kickoff_at"));
  const status = getString(formData, "status") as MatchStatus;
  const isFeatured = getBoolean(formData, "is_featured");

  if (!UUID_RE.test(leagueId)) return { error: "Pick a league." };
  if (!UUID_RE.test(homeTeamId) || !UUID_RE.test(awayTeamId)) {
    return { error: "Pick both teams." };
  }
  if (homeTeamId === awayTeamId) return { error: "Home and away team must be different." };
  if (!kickoffAt) return { error: "Enter a valid kickoff date and time." };
  if (!STATUSES.includes(status)) return { error: "Pick a status." };
  if (isFeatured && status === "archived") {
    return { error: "An archived match can't be featured (the public can't see it)." };
  }

  const values = {
    league_id: leagueId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    kickoff_at: kickoffAt,
    status,
    is_featured: isFeatured,
  };
  const { error } = id
    ? await supabase.from("matches").update(values).eq("id", id)
    : await supabase.from("matches").insert(values);
  if (error) return { error: describeDbError(error) };

  revalidatePublicPages();
  redirect("/admin/matches");
}

// One-click archive/unarchive from the match list. Archiving hides the
// match from the public site (RLS) and stops new votes (submit_vote()),
// but keeps all its votes — nothing is deleted. Unarchiving sets it to
// "finished", the safest guess for an old match; edit it if that's wrong.
export async function setMatchArchived(matchId: string, archived: boolean) {
  const { supabase } = await requireAdmin();
  if (!UUID_RE.test(matchId)) return;

  const { error } = await supabase
    .from("matches")
    .update(
      archived ? { status: "archived", is_featured: false } : { status: "finished" }
    )
    .eq("id", matchId);
  if (error) throw new Error(describeDbError(error));

  revalidatePublicPages();
  revalidatePath("/admin/matches");
}
