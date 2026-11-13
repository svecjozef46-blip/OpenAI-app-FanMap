import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TeamForm } from "@/components/admin/EntityForms";
import { UUID_RE } from "@/lib/admin/form";
import { getAllLeagues, getTeam } from "@/lib/admin/queries";

// Per-request (reads the admin session) — see app/admin/layout.tsx.
export const instant = false;

export default async function EditTeamPage({ params }: PageProps<"/admin/teams/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [team, leagues] = await Promise.all([getTeam(id), getAllLeagues()]);
  if (!team) notFound();

  return (
    <>
      <AdminPageHeader title={team.name} backHref="/admin/teams" />
      <TeamForm team={team} leagues={leagues} />
    </>
  );
}
