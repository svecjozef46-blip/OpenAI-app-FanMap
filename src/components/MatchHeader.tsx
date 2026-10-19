import type { CountryResult, MatchWithTeams } from "@/lib/types";
import { TeamBadge } from "@/components/TeamBadge";

// Layout: LEFT TEAM | CENTER DISTRIBUTION | RIGHT TEAM, per
// dev-prompt-chatgpt.md "MATCH HEADER ABOVE MAP". Using CSS Grid with
// `1fr auto 1fr` (not flexbox) is the explicit requirement there: it's what
// keeps the center percentage bar visually centered regardless of how long
// the team names are, instead of flexbox's content-driven sizing pushing it
// off-center.
export function MatchHeader({
  match,
  results,
}: {
  match: MatchWithTeams;
  results: CountryResult[];
}) {
  const homeVotes = results.reduce((sum, r) => sum + r.homeVotes, 0);
  const awayVotes = results.reduce((sum, r) => sum + r.awayVotes, 0);
  const total = homeVotes + awayVotes;
  const homePct = total > 0 ? Math.round((homeVotes / total) * 100) : 50;
  const awayPct = total > 0 ? 100 - homePct : 50;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3">
      <div className="flex items-center gap-3">
        <TeamBadge team={match.home_team} size={36} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-100">{match.home_team.name}</p>
          <p className="text-sm text-zinc-400">{homeVotes.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex w-40 flex-col items-center gap-1 sm:w-56">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-700">
          <div className="flex h-full w-full">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${homePct}%`, backgroundColor: match.home_team.primary_color }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${awayPct}%`, backgroundColor: match.away_team.primary_color }}
            />
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          {homePct}% · {awayPct}%
        </p>
      </div>

      <div className="flex items-center justify-end gap-3">
        <div className="min-w-0 text-right">
          <p className="truncate font-semibold text-zinc-100">{match.away_team.name}</p>
          <p className="text-sm text-zinc-400">{awayVotes.toLocaleString()}</p>
        </div>
        <TeamBadge team={match.away_team} size={36} />
      </div>
    </div>
  );
}
