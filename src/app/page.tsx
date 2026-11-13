import Link from "next/link";
import { getActiveLeagues, getMatchResultRows, getMatchTotals, getVisibleMatches } from "@/lib/queries";
import { pickDefaultMatch } from "@/lib/matchPage";
import { buildCountryResults } from "@/lib/results";
import { illustrativeHeroCountries, MIN_REAL_COUNTRIES_FOR_HERO } from "@/lib/heroPreview";
import { getMatchColors } from "@/lib/teamColors";
import type { MatchResultRow, MatchWithTeams } from "@/lib/types";
import { SiteNav } from "@/components/SiteNav";
import { HeroShowcase, type ShowcaseItem } from "@/components/HeroShowcase";
import { MatchLinkCard } from "@/components/MatchCard";

// Landing page (dev-prompt-chatgpt.md "HOME PAGE"): a full-screen world map
// rotating through the featured matches, then the big upcoming matches and
// a short "how it works".
//
// Live match list and vote counts → rendered per request. Next.js 16's
// Cache Components would otherwise prerender this page once with stale
// data; `instant = false` opts it out.
export const instant = false;

const MAX_CARDS = 6;
const MAX_SHOWCASE = 6;

// Real map for a match if it has enough decided countries, otherwise a
// clearly-labelled illustration (see lib/heroPreview.ts).
function showcaseItem(match: MatchWithTeams, rows: MatchResultRow[]): ShowcaseItem {
  const colors = getMatchColors(match);
  const decided = buildCountryResults(
    rows.filter((r) => r.match_id === match.id),
    match
  ).filter((r) => r.leadingTeamId);

  if (decided.length >= MIN_REAL_COUNTRIES_FOR_HERO) {
    return {
      match,
      isIllustrative: false,
      slide: {
        homeColor: colors.home,
        awayColor: colors.away,
        countries: decided.map((r) => {
          const homeLeads = r.leadingTeamId === match.home_team_id;
          return {
            code: r.countryCode,
            side: homeLeads ? "home" : "away",
            strength: (homeLeads ? r.homeVotes : r.awayVotes) / r.totalVotes,
          };
        }),
      },
    };
  }
  return {
    match,
    isIllustrative: true,
    slide: { homeColor: colors.home, awayColor: colors.away, countries: illustrativeHeroCountries(match.id) },
  };
}

export default async function HomePage() {
  const [matches, leagues] = await Promise.all([getVisibleMatches(), getActiveLeagues()]);
  const upcoming = matches.filter((m) => m.status === "upcoming" || m.status === "live");

  // Showcase = matches marked "Featured" in /admin, soonest first. Falls
  // back to the default match so the hero is never empty.
  let showcaseMatches = upcoming.filter((m) => m.is_featured).slice(0, MAX_SHOWCASE);
  if (showcaseMatches.length === 0) {
    const fallback = pickDefaultMatch(matches);
    showcaseMatches = fallback ? [fallback] : [];
  }

  // Cards: the featured big games first, then the soonest others.
  const showcaseIds = new Set(showcaseMatches.map((m) => m.id));
  const cardMatches = [...showcaseMatches, ...upcoming.filter((m) => !showcaseIds.has(m.id))].slice(0, MAX_CARDS);

  const [rows, totals] = await Promise.all([
    getMatchResultRows(showcaseMatches.map((m) => m.id)),
    getMatchTotals(cardMatches),
  ]);
  const showcase = showcaseMatches.map((m) => showcaseItem(m, rows));
  const exploreHref = leagues[0] ? `/league/${leagues[0].slug}` : "/matches";

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="sticky top-0 z-30">
        <SiteNav leagues={leagues} active="home" />
      </div>

      {showcase.length > 0 ? (
        <HeroShowcase items={showcase} exploreHref={exploreHref} />
      ) : (
        <section className="flex min-h-[60svh] flex-col items-center justify-center px-4 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl">Global Fan Map</h1>
          <p className="mt-4 text-lg text-zinc-300">See which countries support your club.</p>
        </section>
      )}

      {cardMatches.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-50">Big matches coming up</h2>
            <Link href={exploreHref} className="text-sm text-emerald-400 hover:text-emerald-300">
              All matches →
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cardMatches.map((m) => (
              <li key={m.id}>
                <MatchLinkCard match={m} totals={totals[m.id]} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Pick a match", "Choose any match from the leagues above — no account needed."],
            ["2", "Show who you support", "Tap the team you support — not who you think will win. One vote per match, counted for your country."],
            ["3", "Watch the world take sides", "Each country takes the color of the team most of its fans support."],
          ].map(([n, title, text]) => (
            <li key={n} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <span className="text-sm font-semibold text-emerald-400">{n}</span>
              <h3 className="mt-2 font-semibold text-zinc-100">{title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-white/[0.06] px-4 py-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Global Fan Map · Fan-made project, not affiliated with any club or league.
      </footer>
    </div>
  );
}
