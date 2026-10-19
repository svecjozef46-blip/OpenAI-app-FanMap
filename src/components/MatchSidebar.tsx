import type { MatchWithTeams } from "@/lib/types";
import { MatchRow } from "@/components/MatchRow";

export function MatchSidebar({
  matches,
  selectedMatchId,
  onViewMap,
}: {
  matches: MatchWithTeams[];
  selectedMatchId: string;
  onViewMap: (matchId: string) => void;
}) {
  return (
    <nav
      aria-label="Matches"
      className="flex h-full w-full flex-col gap-2 overflow-y-auto border-r border-white/10 bg-zinc-950/60 p-3 sm:w-80"
    >
      {matches.length === 0 && (
        <p className="p-3 text-sm text-zinc-500">No matches yet.</p>
      )}
      {matches.map((match) => (
        <MatchRow
          key={match.id}
          match={match}
          isSelected={match.id === selectedMatchId}
          onViewMap={onViewMap}
        />
      ))}
    </nav>
  );
}
