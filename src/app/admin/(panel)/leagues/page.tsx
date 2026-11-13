import Link from "next/link";
import { AdminPageHeader, tableClass, tdClass, thClass } from "@/components/admin/AdminPageHeader";
import { getAllLeagues } from "@/lib/admin/queries";

// Per-request (reads the admin session) — see app/admin/layout.tsx.
export const instant = false;

export default async function AdminLeaguesPage() {
  const leagues = await getAllLeagues();

  return (
    <>
      <AdminPageHeader title="Leagues" action={{ href: "/admin/leagues/new", label: "+ New league" }} />
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Slug</th>
              <th className={thClass}>Sport</th>
              <th className={thClass}>Active</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {leagues.map((l) => (
              <tr key={l.id} className={l.is_active ? "" : "opacity-50"}>
                <td className={tdClass}>{l.name}</td>
                <td className={tdClass}>{l.slug}</td>
                <td className={tdClass}>{l.sport}</td>
                <td className={tdClass}>{l.is_active ? "Yes" : "No"}</td>
                <td className={`${tdClass} text-right`}>
                  <Link href={`/admin/leagues/${l.id}`} className="text-emerald-400 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
