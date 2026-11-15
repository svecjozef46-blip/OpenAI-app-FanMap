import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getNextRoundKickoff, getVisibleMatches } from "@/lib/queries";
import { loadMatchScreenData, pickDefaultMatch } from "@/lib/matchPage";
import { MatchScreen } from "@/components/MatchScreen";

// Live data → per-request render (see app/page.tsx).
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/league/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  return {
    title: league ? `${league.name} — Global Fan Map` : "League not found — Global Fan Map",
    description: league ? `${league.name}: see which countries support each team.` : undefined,
  };
}

export default async function LeaguePage({ params }: PageProps<"/league/[slug]">) {
  const { slug } = await params;
  // Inactive leagues are hidden by RLS, so they 404 here as intended.
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const matches = await getVisibleMatches(league.id);
  const [{ leagues, totals }, nextRoundKickoff] = await Promise.all([
    loadMatchScreenData(matches),
    matches.length === 0 ? getNextRoundKickoff(league.id) : null,
  ]);

  return (
    <MatchScreen
      leagues={leagues}
      active={league.slug}
      title={league.name}
      matches={matches}
      totals={totals}
      selectedMatchId={pickDefaultMatch(matches)?.id}
      nextRoundKickoff={nextRoundKickoff}
    />
  );
}
