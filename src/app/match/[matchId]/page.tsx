import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMatchById, getVisibleMatches } from "@/lib/queries";
import { MatchExperience } from "@/components/MatchExperience";

// Per-match direct URL (dev-prompt-chatgpt.md "SHARING": "/match/{matchId}
// ... opening it loads the app, selects the correct match, map, and
// results"). generateMetadata below is also the entire reason
// tech-stack.md chose Next.js over Vite: a shared link needs to show the
// actual match in its social preview card, not a generic site thumbnail —
// that only works with metadata generated server-side per match.
// Always reflects the current match/vote state server-side, so — same as
// app/page.tsx — it opts out of Next.js 16's default static prerendering.
export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}): Promise<Metadata> {
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

export default async function MatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const match = await getMatchById(matchId);
  if (!match) {
    notFound();
  }

  const matches = await getVisibleMatches();
  // The requested match might not be in the "visible" list (e.g. it just
  // changed status) — include it explicitly so a direct link always works
  // even if it wouldn't otherwise show up in the sidebar.
  const allMatches = matches.some((m) => m.id === match.id)
    ? matches
    : [match, ...matches];

  return (
    <div className="min-h-0 flex-1">
      <MatchExperience matches={allMatches} initialSelectedMatchId={match.id} />
    </div>
  );
}
