import Link from "next/link";
import type { League } from "@/lib/types";

// Top navigation: brand + one tab per active league (from the database, so
// adding a league in /admin adds a tab — nothing hardcoded here). On
// narrow screens the tabs scroll horizontally instead of wrapping.
//
// `active` is passed in by each page ("home" or a league slug)
// rather than read from the URL, because on a /match/{id} page the active
// tab is that match's league, which only the page knows.
export function SiteNav({ leagues, active }: { leagues: League[]; active: string }) {
  const tabs = [
    { key: "home", href: "/", label: "Home" },
    ...leagues.map((l) => ({ key: l.slug, href: `/league/${l.slug}`, label: l.name })),
  ];

  return (
    <header className="z-20 shrink-0 border-b border-white/[0.06] bg-zinc-950/90 backdrop-blur-md">
      <div className="flex h-14 items-center gap-4 px-3 sm:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-zinc-50">
          <GlobeIcon />
          <span className="hidden sm:inline">Global Fan Map</span>
        </Link>
        <nav aria-label="Leagues" className="no-scrollbar -mr-3 flex min-w-0 flex-1 gap-1 overflow-x-auto pr-3">
          {tabs.map((tab) => {
            const isActive = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-emerald-500/15 font-medium text-emerald-300"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function GlobeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="#34d399" strokeWidth="1.5" />
      <path
        d="M2.75 12h18.5M12 2.75c2.6 2.6 3.9 5.7 3.9 9.25s-1.3 6.65-3.9 9.25M12 2.75C9.4 5.35 8.1 8.45 8.1 12s1.3 6.65 3.9 9.25"
        stroke="#34d399"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
