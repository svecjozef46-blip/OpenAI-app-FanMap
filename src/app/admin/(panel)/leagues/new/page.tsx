import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LeagueForm } from "@/components/admin/EntityForms";
import { requireAdmin } from "@/lib/admin/auth";

// Per-request (reads the admin session) — see app/admin/layout.tsx.
export const instant = false;

export default async function NewLeaguePage() {
  // No data to load here, but still gate it explicitly (see lib/admin/auth.ts).
  await requireAdmin();
  return (
    <>
      <AdminPageHeader title="New league" backHref="/admin/leagues" />
      <LeagueForm />
    </>
  );
}
