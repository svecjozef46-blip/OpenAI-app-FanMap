import Link from "next/link";
import type { League, MatchTotals, MatchWithTeams } from "@/lib/types";
import { SiteNav } from "@/components/SiteNav";
import { MatchExperience } from "@/components/MatchExperience";

// Page frame for every match screen: top navigation + the match experience,
// or a friendly empty state when a league has no matches yet.
export function MatchScreen({
  leagues,
  active,
  title,
  matches,
  totals,
  selectedMatchId,
}: {
  leagues: League[];
  active: string;
  title: string;
  matches: MatchWithTeams[];
  totals: Record<string, MatchTotals>;
  selectedMatchId: string | undefined;
}) {
  return (
    <div className="flex h-full flex-col">
      <SiteNav leagues={leagues} active={active} />
      <main className="min-h-0 flex-1">
        {selectedMatchId && matches.length > 0 ? (
          <MatchExperience
            title={title}
            matches={matches}
            totals={totals}
            initialSelectedMatchId={selectedMatchId}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-lg font-semibold text-zinc-100">No matches in {title} yet</p>
            <p className="max-w-sm text-sm text-zinc-400">
              New fixtures are added regularly. Meanwhile, see what&apos;s on in other competitions.
            </p>
            <Link
              href="/matches"
              className="mt-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Browse all matches
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
