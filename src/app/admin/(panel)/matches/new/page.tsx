import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MatchForm } from "@/components/admin/EntityForms";
import { getAllLeagues, getAllTeams } from "@/lib/admin/queries";

// Per-request (reads the admin session) — see app/admin/layout.tsx.
export const instant = false;

export default async function NewMatchPage() {
  const [leagues, teams] = await Promise.all([getAllLeagues(), getAllTeams()]);
  return (
    <>
      <AdminPageHeader title="New match" backHref="/admin/matches" />
      <MatchForm leagues={leagues} teams={teams} />
    </>
  );
}
