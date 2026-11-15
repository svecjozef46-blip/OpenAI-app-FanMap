import Link from "next/link";
import {
  getActiveLeagues,
  getMatchResultRows,
  getMatchTotals,
  getNextRoundKickoff,
  getVisibleMatches,
} from "@/lib/queries";
import { formatRoundStart } from "@/lib/week";
import { pickDefaultMatch } from "@/lib/matchPage";
import { buildCountryResults } from "@/lib/results";
import { illustrativeHeroCountries, MIN_REAL_COUNTRIES_FOR_HERO } from "@/lib/heroPreview";
import type { MatchResultRow, MatchWithTeams } from "@/lib/types";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroShowcase, type ShowcaseItem } from "@/components/HeroShowcase";
import { MatchLinkCard } from "@/components/MatchCard";

// Home page. Structure follows a classic product landing page:
//   1. Hero — one promise ("The world is taking sides."), one primary
//      action, and the product itself (the map) as the visual.
//   2. Big matches — the reason to act now.
//   3. What makes it different — support, not prediction.
//   4. How it works — three steps.
//   5. Closing call to action.
// No invented numbers or testimonials anywhere: until real votes exist, the
// hero map is labelled as illustrative (see lib/heroPreview.ts).
//
// Live match list and vote counts → rendered per request. Next.js 16's
// Cache Components would otherwise prerender this page once with stale
// data; `instant = false` opts it out.
export const instant = false;

const MAX_CARDS = 6;
const MAX_SHOWCASE = 6;

// Real map for a match if it has enough decided countries, otherwise a
// clearly-labelled illustration.
function showcaseItem(match: MatchWithTeams, rows: MatchResultRow[]): ShowcaseItem {
  const decided = buildCountryResults(
    rows.filter((r) => r.match_id === match.id),
    match
  ).filter((r) => r.leadingTeamId);

  if (decided.length < MIN_REAL_COUNTRIES_FOR_HERO) {
    return { match, isIllustrative: true, countries: illustrativeHeroCountries(match.id) };
  }
  return {
    match,
    isIllustrative: false,
    countries: decided.map((r) => {
      const homeLeads = r.leadingTeamId === match.home_team_id;
      return {
        code: r.countryCode,
        side: homeLeads ? "home" : "away",
        strength: (homeLeads ? r.homeVotes : r.awayVotes) / r.totalVotes,
      };
    }),
  };
}

const STEPS = [
  ["Pick a match", "Choose from this week's fixtures across Europe's top leagues. No account, no sign-up."],
  ["Back your team", "One tap for the team you support. One vote per match, counted for your country."],
  ["Watch the world take sides", "Each country takes the color of the team most of its fans stand behind."],
];

export default async function HomePage() {
  const [matches, leagues] = await Promise.all([getVisibleMatches(), getActiveLeagues()]);
  const upcoming = matches.filter((m) => m.status === "upcoming" || m.status === "live");

  // Showcase = matches marked "Featured" in /admin, soonest first. Falls
  // back to the default match so the hero is never empty.
  let showcaseMatches = upcoming.filter((m) => m.is_featured).slice(0, MAX_SHOWCASE);
  if (showcaseMatches.length === 0) {
    const fallback = pickDefaultMatch(upcoming.length > 0 ? upcoming : matches);
    showcaseMatches = fallback ? [fallback] : [];
  }

  // Cards: the featured big games first, then the soonest others.
  const showcaseIds = new Set(showcaseMatches.map((m) => m.id));
  const cardMatches = [...showcaseMatches, ...upcoming.filter((m) => !showcaseIds.has(m.id))].slice(0, MAX_CARDS);

  const [rows, totals, nextRoundKickoff] = await Promise.all([
    getMatchResultRows(showcaseMatches.map((m) => m.id)),
    getMatchTotals(cardMatches),
    // Lists show only this week (lib/week.ts); on an empty week, say when
    // the next round starts instead of showing nothing.
    matches.length === 0 ? getNextRoundKickoff() : null,
  ]);
  const showcase = showcaseMatches.map((m) => showcaseItem(m, rows));
  const leagueName = new Map(leagues.map((l) => [l.id, l.name]));
  const exploreHref = leagues[0] ? `/league/${leagues[0].slug}` : "/matches";

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="sticky top-0 z-30">
        <SiteNav leagues={leagues} active="home" />
      </div>

      <main>
        {showcase.length > 0 ? (
          <HeroShowcase items={showcase} exploreHref={exploreHref} />
        ) : (
          <section className="flex min-h-[60svh] flex-col items-center justify-center px-5 text-center">
            <h1 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] uppercase leading-[0.92] tracking-[-0.02em]">
              The world is taking sides.
            </h1>
            <p className="mt-5 text-lg text-muted">
              {nextRoundKickoff
                ? `No matches this week. The next round starts ${formatRoundStart(nextRoundKickoff)}.`
                : "New matches are on their way."}
            </p>
          </section>
        )}

        {cardMatches.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 pt-20 sm:pt-28">
            <div className="reveal mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <h2 className="font-display text-[clamp(1.7rem,3.6vw,2.75rem)] uppercase leading-none tracking-[-0.01em]">This week&apos;s big matches</h2>
              <Link href={exploreHref} className="text-[15px] font-medium text-accent hover:underline">
                All matches <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cardMatches.map((m) => (
                <li key={m.id} className="reveal">
                  <MatchLinkCard match={m} totals={totals[m.id]} leagueName={leagueName.get(m.league_id)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="reveal mx-auto max-w-4xl px-5 py-28 text-center sm:py-40">
          <h2 className="text-balance font-display text-[clamp(2rem,5.2vw,3.75rem)] uppercase leading-[0.95] tracking-[-0.02em]">
            Not a prediction. <span className="text-accent">A declaration.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted sm:text-xl">
            Fan Map never asks who will win. It asks who you&apos;re with — and shows where the rest of the world
            stands, country by country.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5">
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="reveal flex flex-col rounded-2xl bg-surface p-7 sm:p-8">
                <span className="text-sm font-semibold text-accent">{`0${i + 1}`}</span>
                <h3 className="mt-10 text-2xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="reveal mx-auto flex max-w-4xl flex-col items-center px-5 py-28 text-center sm:py-40">
          <h2 className="text-balance font-display text-[clamp(2rem,5.2vw,3.75rem)] uppercase leading-[0.95] tracking-[-0.02em]">Your country is waiting.</h2>
          <p className="mt-5 max-w-xl text-lg text-muted sm:text-xl">It takes one tap to put it on the map.</p>
          <Link
            href={showcaseMatches[0] ? `/match/${showcaseMatches[0].id}` : exploreHref}
            className="mt-8 rounded-lg bg-accent px-7 py-3.5 text-base font-semibold text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Show your support
          </Link>
        </section>
      </main>

      <SiteFooter leagues={leagues} />
    </div>
  );
}
