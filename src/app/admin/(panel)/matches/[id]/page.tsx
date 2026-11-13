import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MatchForm } from "@/components/admin/EntityForms";
import { UUID_RE } from "@/lib/admin/form";
import { getAllLeagues, getAllTeams, getMatch } from "@/lib/admin/queries";

// Per-request (reads the admin session) — see app/admin/layout.tsx.
export const instant = false;

export default async function EditMatchPage({ params }: PageProps<"/admin/matches/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [match, leagues, teams] = await Promise.all([getMatch(id), getAllLeagues(), getAllTeams()]);
  if (!match) notFound();

  return (
    <>
      <AdminPageHeader title={`${match.home_team.name} vs ${match.away_team.name}`} backHref="/admin/matches" />
      <MatchForm match={match} leagues={leagues} teams={teams} />
    </>
  );
}
