import Link from "next/link";
import type { League } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";

// Top navigation: brand (links home), one tab per active league and the
// light/dark toggle. Tabs come from the database, so adding a league in
// /admin adds a tab — nothing hardcoded here. On narrow screens the tabs
// scroll horizontally instead of wrapping.
//
// `active` is passed in by each page ("home" or a league slug) rather than
// read from the URL, because on a /match/{id} page the active tab is that
// match's league, which only the page knows.
export function SiteNav({ leagues, active }: { leagues: League[]; active: string }) {
  return (
    <header className="z-20 shrink-0 border-b border-line bg-glass backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-[1680px] items-center gap-3 px-3 sm:gap-5 sm:px-5">
        <Link
          href="/"
          aria-current={active === "home" ? "page" : undefined}
          className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight text-fg"
        >
          <GlobeIcon />
          <span className="hidden sm:inline">Global Fan Map</span>
        </Link>
        <nav aria-label="Leagues" className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto sm:justify-center">
          {leagues.map((league) => {
            const isActive = league.slug === active;
            return (
              <Link
                key={league.id}
                href={`/league/${league.slug}`}
                aria-current={isActive ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                  isActive ? "bg-fg/10 font-medium text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {league.name}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M2.75 12h18.5M12 2.75c2.6 2.6 3.9 5.7 3.9 9.25s-1.3 6.65-3.9 9.25M12 2.75C9.4 5.35 8.1 8.45 8.1 12s1.3 6.65 3.9 9.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
