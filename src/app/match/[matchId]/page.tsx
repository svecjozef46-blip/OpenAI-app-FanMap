import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMatchById, getVisibleMatches } from "@/lib/queries";
import { loadMatchScreenData } from "@/lib/matchPage";
import { MatchScreen } from "@/components/MatchScreen";

// Per-match direct URL (dev-prompt-chatgpt.md "SHARING": "/match/{matchId}
// ... opening it loads the app, selects the correct match, map, and
// results"). generateMetadata below is also the entire reason
// tech-stack.md chose Next.js over Vite: a shared link needs to show the
// actual match in its social preview card, not a generic site thumbnail —
// that only works with metadata generated server-side per match.
// Always reflects the current match/vote state, so — same as app/page.tsx
// — it opts out of Next.js 16's default static prerendering.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/match/[matchId]">): Promise<Metadata> {
  const { matchId } = await params;
  const match = await getMatchById(matchId);
  if (!match) {
    return { title: "Match not found — Global Fan Map" };
  }
  const title = `${match.home_team.name} vs ${match.away_team.name} — Global Fan Map`;
  const description = "See which countries support each team. Vote for yours.";
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function MatchPage({ params }: PageProps<"/match/[matchId]">) {
  const { matchId } = await params;
  const match = await getMatchById(matchId);
  if (!match) {
    notFound();
  }

  // Show the match among the other matches of its league, with that
  // league's tab active.
  const leagueMatches = await getVisibleMatches(match.league_id);
  // A direct link must always work, even if the match isn't in the list
  // (e.g. its status just changed) — include it explicitly.
  const matches = leagueMatches.some((m) => m.id === match.id) ? leagueMatches : [match, ...leagueMatches];
  const { leagues, totals } = await loadMatchScreenData(matches);
  const league = leagues.find((l) => l.id === match.league_id);

  return (
    <MatchScreen
      leagues={leagues}
      active={league?.slug ?? "all"}
      title={league?.name ?? "Matches"}
      matches={matches}
      totals={totals}
      selectedMatchId={match.id}
    />
  );
}
