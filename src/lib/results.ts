import type { CountryResult, MatchResultRow, MatchWithTeams } from "@/lib/types";

// Minimum combined votes a country needs before the map colors it for
// either team. Below this, a country that happens to have gotten 1 vote
// would show as "100% supports Team X" — misleading with a tiny sample.
// This was a gap we flagged in the original ChatGPT dev prompt (it only
// handled "0 votes = neutral", not "few votes = misleading 100%") — see
// docs/tech-stack.md "Revízia po ChatGPT dev-prompte" and docs/idea.md.
//
// 3 is a placeholder, not a researched number: there's no real traffic yet
// to calibrate against. Revisit once matches are getting real votes, and
// definitely raise this (likely well above 3) before any B2B/media pitch —
// see docs/business-case.md "Monetizácia": sample credibility is the whole
// pitch there.
export const MIN_VOTES_TO_COLOR = 3;

// Turns the raw (team, country, count) rows from the match_results view
// into one roll-up per country, deciding a leading team only when the
// sample clears MIN_VOTES_TO_COLOR and isn't a tie.
export function buildCountryResults(
  rows: MatchResultRow[],
  match: MatchWithTeams
): CountryResult[] {
  const byCountry = new Map<string, { home: number; away: number }>();

  for (const row of rows) {
    const entry = byCountry.get(row.country_code) ?? { home: 0, away: 0 };
    if (row.team_id === match.home_team_id) {
      entry.home += row.vote_count;
    } else if (row.team_id === match.away_team_id) {
      entry.away += row.vote_count;
    }
    byCountry.set(row.country_code, entry);
  }

  const results: CountryResult[] = [];
  for (const [countryCode, { home, away }] of byCountry) {
    const totalVotes = home + away;
    let leadingTeamId: string | null = null;
    if (totalVotes >= MIN_VOTES_TO_COLOR && home !== away) {
      leadingTeamId = home > away ? match.home_team_id : match.away_team_id;
    }
    results.push({
      countryCode,
      homeVotes: home,
      awayVotes: away,
      totalVotes,
      leadingTeamId,
    });
  }
  return results;
}
