import Link from "next/link";
import { AdminPageHeader, tableClass, tdClass, thClass } from "@/components/admin/AdminPageHeader";
import { TeamBadge } from "@/components/TeamBadge";
import { getAllLeagues, getAllTeams } from "@/lib/admin/queries";

// Per-request (reads the admin session) — see app/admin/layout.tsx.
export const instant = false;

export default async function AdminTeamsPage() {
  const [teams, leagues] = await Promise.all([getAllTeams(), getAllLeagues()]);
  const leagueName = new Map(leagues.map((l) => [l.id, l.name]));

  return (
    <>
      <AdminPageHeader title="Teams" action={{ href: "/admin/teams/new", label: "+ New team" }} />
      {teams.length === 0 ? (
        <p className="text-zinc-400">No teams yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Team</th>
                <th className={thClass}>League</th>
                <th className={thClass}>Active</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className={t.is_active ? "" : "opacity-50"}>
                  <td className={tdClass}>
                    <span className="flex items-center gap-2">
                      <TeamBadge team={t} size={24} />
                      {t.name}
                    </span>
                  </td>
                  <td className={tdClass}>{leagueName.get(t.league_id)}</td>
                  <td className={tdClass}>{t.is_active ? "Yes" : "No"}</td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/admin/teams/${t.id}`} className="text-emerald-400 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
