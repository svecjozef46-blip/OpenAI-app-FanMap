import type { Metadata } from "next";
import { getVisibleMatches } from "@/lib/queries";
import { loadMatchScreenData, pickDefaultMatch } from "@/lib/matchPage";
import { MatchScreen } from "@/components/MatchScreen";

// Live match list and vote counts → rendered per request, not prerendered
// (Next.js 16 Cache Components default; see app/page.tsx).
export const instant = false;

export const metadata: Metadata = {
  title: "All matches — Global Fan Map",
  description: "Pick a match and see which countries support each team.",
};

export default async function AllMatchesPage() {
  const matches = await getVisibleMatches();
  const { leagues, totals } = await loadMatchScreenData(matches);

  return (
    <MatchScreen
      leagues={leagues}
      active="all"
      title="All matches"
      matches={matches}
      totals={totals}
      selectedMatchId={pickDefaultMatch(matches)?.id}
    />
  );
}
