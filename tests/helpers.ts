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
    "id,status,home_team_id,away_team_id,home_team:teams!matches_home_team_id_fkey!inner(*),away_team:teams!matches_away_team_id_fkey!inner(*),league:leagues!inner(id)";
  const response = await supabaseRest(`matches?select=${select}`);
  if (!response.ok) throw new Error(`Could not load matches: ${response.status}`);
  return response.json();
}

// Fixtures for the voting tests: a hidden league ("Internal tests",
// is_active = false, so the site never shows it) with one open and one
// finished match. Created once in the database — see tests/README.md.
export const FIXTURE = {
  openMatchId: "00000000-0000-4000-a000-000000000021",
  finishedMatchId: "00000000-0000-4000-a000-000000000022",
  homeTeamId: "00000000-0000-4000-a000-000000000011",
  awayTeamId: "00000000-0000-4000-a000-000000000012",
};

// The server secret (.env.local). Tests use it for two things only: to
// identify themselves to /api/votes (they can't solve a Turnstile challenge)
// and to exercise the rate-limit function directly.
export const VOTE_SECRET = process.env.FANMAP_VOTE_SECRET ?? "";
// Whether the app under test enforces the Turnstile human check.
export const TURNSTILE_ON = Boolean(process.env.TURNSTILE_SECRET_KEY);

// Sends a vote through the app's own API, like the vote buttons do.
// By default as our trusted test caller (skips the human check and the rate
// limit); `asVisitor` sends it exactly as an unknown visitor would, and
// `testSecret` lets a test try a wrong secret.
export function postVote(
  body: unknown,
  { asVisitor = false, testSecret = VOTE_SECRET } = {}
): Promise<Response> {
  return fetch(`${APP_URL}/api/votes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(asVisitor ? {} : { "x-fanmap-test-secret": testSecret }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
