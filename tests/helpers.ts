// Shared setup for the tests in this folder. They run with Node's built-in
// test runner (`npm test`) — no extra test framework to install or maintain.
//
// Tests talk to the real Supabase project named in .env.local, using only
// the public anon key (the same access any visitor has). Nothing here needs
// or uses a service-role key.

process.loadEnvFile(".env.local");

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// The app under test for the API tests; start it with `npm run dev`.
export const APP_URL = process.env.FANMAP_TEST_APP_URL ?? "http://localhost:3000";

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error("Tests need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
}

// Calls Supabase's REST API exactly as an anonymous visitor would.
export function supabaseRest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export type TestTeam = { id: string; name: string; short_name: string; primary_color: string; secondary_color: string };
export type TestMatch = {
  id: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_team: TestTeam;
  away_team: TestTeam;
};

// Every match a visitor can see, with both teams.
export async function getVisibleMatches(): Promise<TestMatch[]> {
  const select =
    "id,status,home_team_id,away_team_id,home_team:teams!matches_home_team_id_fkey(*),away_team:teams!matches_away_team_id_fkey(*)";
  const response = await supabaseRest(`matches?select=${select}`);
  if (!response.ok) throw new Error(`Could not load matches: ${response.status}`);
  return response.json();
}
