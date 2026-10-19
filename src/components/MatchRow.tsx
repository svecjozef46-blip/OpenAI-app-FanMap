import type { MatchWithTeams } from "@/lib/types";
import { TeamBadge } from "@/components/TeamBadge";
import { VoteButton } from "@/components/VoteButton";

const STATUS_LABEL: Record<MatchWithTeams["status"], string> = {
  upcoming: "Upcoming",
  live: "Live",
  finished: "Finished",
  archived: "Archived",
};

// dev-prompt-chatgpt.md "CRITICAL INTERACTION RULES": match selection and
// voting must be completely separate actions, with no shared click handler
// and no element nested inside another. This component has NO onClick on
// its root container — only the three buttons below (home vote, away vote,
// View Map) have handlers, each independent. That's deliberate, not an
// oversight: don't add a row-level onClick here even for convenience.
export function MatchRow({
  match,
  isSelected,
  onViewMap,
}: {
  match: MatchWithTeams;
  isSelected: boolean;
  onViewMap: (matchId: string) => void;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg p-3 ${
        isSelected ? "bg-white/10" : "bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className={match.status === "live" ? "font-semibold text-red-400" : ""}>
          {STATUS_LABEL[match.status]}
        </span>
        <time dateTime={match.kickoff_at}>
          {new Date(match.kickoff_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <TeamBadge team={match.home_team} size={24} />
          <span className="truncate text-sm text-zinc-200">{match.home_team.short_name}</span>
        </div>
        <span className="shrink-0 text-xs text-zinc-500">vs</span>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-sm text-zinc-200">{match.away_team.short_name}</span>
          <TeamBadge team={match.away_team} size={24} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <VoteButton matchId={match.id} team={match.home_team} />
        <VoteButton matchId={match.id} team={match.away_team} align="right" />
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onViewMap(match.id);
        }}
        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          isSelected
            ? "bg-white/20 text-zinc-100"
            : "bg-white/5 text-zinc-300 hover:bg-white/10"
        }`}
      >
        View Map
      </button>
    </div>
  );
}
