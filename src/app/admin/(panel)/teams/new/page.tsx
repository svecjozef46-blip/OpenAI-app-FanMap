import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TeamForm } from "@/components/admin/EntityForms";
import { getAllLeagues } from "@/lib/admin/queries";

// Per-request (reads the admin session) — see app/admin/layout.tsx.
export const instant = false;

export default async function NewTeamPage() {
  const leagues = await getAllLeagues();
  return (
    <>
      <AdminPageHeader title="New team" backHref="/admin/teams" />
      <TeamForm leagues={leagues} />
    </>
  );
}
