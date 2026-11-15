import Link from "next/link";
import type { League, MatchTotals, MatchWithTeams } from "@/lib/types";
import { formatRoundStart } from "@/lib/week";
import { SiteNav } from "@/components/SiteNav";
import { MatchExperience } from "@/components/MatchExperience";

// Page frame for every match screen: top navigation + the match experience,
// or a friendly empty state when there are no matches this week (lists show
// only the current week — lib/week.ts).
export function MatchScreen({
  leagues,
  active,
  title,
  matches,
  totals,
  selectedMatchId,
  nextRoundKickoff = null,
}: {
  leagues: League[];
  active: string;
  title: string;
  matches: MatchWithTeams[];
  totals: Record<string, MatchTotals>;
  selectedMatchId: string | undefined;
  // First kickoff after this week, shown when this week is empty.
  nextRoundKickoff?: string | null;
}) {
  const isAll = active === "all";
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
            <p className="text-2xl font-semibold tracking-tight">
              {isAll ? "No matches this week" : `No ${title} matches this week`}
            </p>
            <p className="max-w-sm text-muted">
              {nextRoundKickoff
                ? `The next round starts ${formatRoundStart(nextRoundKickoff)}. Come back then to back your team.`
                : "New fixtures are added regularly. Check back soon."}
            </p>
            {!isAll && (
              <Link
                href="/matches"
                className="mt-3 rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-85"
              >
                See all of this week&apos;s matches
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
