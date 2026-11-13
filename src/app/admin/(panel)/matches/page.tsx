import Link from "next/link";
import { AdminPageHeader, tableClass, tdClass, thClass } from "@/components/admin/AdminPageHeader";
import { getAllLeagues, getAllMatches } from "@/lib/admin/queries";
import { setMatchArchived } from "../actions";

// Per-request (reads the admin session) — see app/admin/layout.tsx.
export const instant = false;

export default async function AdminMatchesPage() {
  const [matches, leagues] = await Promise.all([getAllMatches(), getAllLeagues()]);
  const leagueName = new Map(leagues.map((l) => [l.id, l.name]));

  return (
    <>
      <AdminPageHeader title="Matches" action={{ href: "/admin/matches/new", label: "+ New match" }} />
      {matches.length === 0 ? (
        <p className="text-zinc-400">No matches yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Kickoff (UTC)</th>
                <th className={thClass}>Match</th>
                <th className={thClass}>League</th>
                <th className={thClass}>Status</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => {
                const archived = m.status === "archived";
                return (
                  <tr key={m.id} className={archived ? "opacity-50" : ""}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {m.kickoff_at.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className={tdClass}>
                      {m.home_team.name} vs {m.away_team.name}
                      {m.is_featured && (
                        <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-300">
                          Featured
                        </span>
                      )}
                    </td>
                    <td className={tdClass}>{leagueName.get(m.league_id)}</td>
                    <td className={tdClass}>{m.status}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      <Link href={`/admin/matches/${m.id}`} className="mr-4 text-emerald-400 hover:underline">
                        Edit
                      </Link>
                      <form action={setMatchArchived.bind(null, m.id, !archived)} className="inline">
                        <button type="submit" className="text-zinc-400 hover:text-white hover:underline">
                          {archived ? "Unarchive" : "Archive"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
