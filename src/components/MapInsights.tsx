"use client";

import type { CountryResult, MatchWithTeams, Team } from "@/lib/types";
import { countryName } from "@/lib/format";
import { MIN_VOTES_TO_COLOR } from "@/lib/results";
import { getMatchColors } from "@/lib/teamColors";

const TOP_N = 3;

// Small panel over the map: color legend + each team's strongest countries
// (dev-prompt brief "COUNTRY STATISTICS"). Only real vote data — with no
// votes it says so instead of showing anything made up.
export function MapInsights({ match, results }: { match: MatchWithTeams; results: CountryResult[] }) {
  const hasVotes = results.some((r) => r.totalVotes > 0);
  const colors = getMatchColors(match);

  return (
    <div className="w-full max-w-sm rounded-xl md:w-60 border border-white/10 bg-zinc-950/80 p-3 text-xs shadow-xl shadow-black/40 backdrop-blur-md">
      {hasVotes ? (
        <div className="grid grid-cols-2 gap-3">
          <TopCountries team={match.home_team} color={colors.home} results={results} pick={(r) => r.homeVotes} />
          <TopCountries team={match.away_team} color={colors.away} results={results} pick={(r) => r.awayVotes} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <Legend team={match.home_team} color={colors.home} />
            <Legend team={match.away_team} color={colors.away} />
          </div>
          <p className="text-zinc-400">No supporters yet — be the first to put your country on the map.</p>
        </div>
      )}
      <p className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] leading-snug text-zinc-500">
        A country is colored once {MIN_VOTES_TO_COLOR}+ fans there have voted. Stronger color = clearer lead.
      </p>
    </div>
  );
}

function Legend({ team, color }: { team: Team; color: string }) {
  return (
    <span className="flex items-center gap-1.5 font-semibold text-zinc-200">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {team.short_name}
    </span>
  );
}

function TopCountries({
  team,
  color,
  results,
  pick,
}: {
  team: Team;
  color: string;
  results: CountryResult[];
  pick: (r: CountryResult) => number;
}) {
  const top = results
    .filter((r) => pick(r) > 0)
    .sort((a, b) => pick(b) - pick(a))
    .slice(0, TOP_N);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Legend team={team} color={color} />
      {top.length === 0 ? (
        <span className="text-zinc-500">—</span>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {top.map((r) => (
            <li key={r.countryCode} className="flex justify-between gap-2 text-zinc-300">
              <span className="truncate">{countryName(r.countryCode)}</span>
              <span className="tabular-nums text-zinc-500">{pick(r).toLocaleString("en-US")}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
