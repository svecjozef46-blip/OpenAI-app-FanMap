import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LeagueForm } from "@/components/admin/EntityForms";
import { UUID_RE } from "@/lib/admin/form";
import { getLeague } from "@/lib/admin/queries";

// Per-request (reads the admin session) — see app/admin/layout.tsx.
export const instant = false;

export default async function EditLeaguePage({ params }: PageProps<"/admin/leagues/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const league = await getLeague(id);
  if (!league) notFound();

  return (
    <>
      <AdminPageHeader title={league.name} backHref="/admin/leagues" />
      <LeagueForm league={league} />
    </>
  );
}
