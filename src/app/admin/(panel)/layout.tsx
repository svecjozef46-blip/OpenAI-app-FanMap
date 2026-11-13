import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { signOut } from "../login/actions";

// Everything inside the (panel) route group requires an admin. The
// "(panel)" folder name doesn't appear in URLs — it only exists so
// /admin/login can live outside this gated layout.
//
// This check is a convenience (redirects non-admins before rendering).
// Each page's data reads and each Server Action call requireAdmin() again,
// because layouts don't re-run on every navigation and actions are public
// endpoints — see lib/admin/auth.ts.
export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireAdmin();

  return (
    <div className="min-h-full">
      <header className="border-b border-white/10 bg-zinc-900">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
          <span className="font-semibold text-zinc-50">Fan Map Admin</span>
          <Link href="/admin/matches" className="text-zinc-300 hover:text-white">
            Matches
          </Link>
          <Link href="/admin/teams" className="text-zinc-300 hover:text-white">
            Teams
          </Link>
          <Link href="/admin/leagues" className="text-zinc-300 hover:text-white">
            Leagues
          </Link>
          <Link href="/" className="text-zinc-500 hover:text-white">
            View site ↗
          </Link>
          <span className="ml-auto text-zinc-500">{user.email}</span>
          <form action={signOut}>
            <button type="submit" className="text-zinc-300 hover:text-white">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
