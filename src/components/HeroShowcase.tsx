"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MatchWithTeams } from "@/lib/types";
import type { HeroCountry } from "@/lib/heroPreview";
import { HeroMap, type HeroSlide } from "@/components/HeroMap";
import { TeamBadge } from "@/components/TeamBadge";
import { useKickoffLabel } from "@/lib/format";
import { getMatchColors } from "@/lib/teamColors";
import { useTheme } from "@/lib/theme";

export type ShowcaseItem = { match: MatchWithTeams; countries: HeroCountry[]; isIllustrative: boolean };

const ROTATE_MS = 7000;

// Home-page hero: the world map IS the hero. It fills the whole first
// screen and rotates through the featured matches (set "Featured" in
// /admin), re-coloring the world for each one.
//   - Desktop: the headline sits small in the map's empty bottom-left corner
//     (South Pacific) and the match caption at the bottom centre (ocean south
//     of Africa), so nothing covers a country.
//   - Phones: a compact headline above the map, caption over its bottom edge.
// The caption's dots jump between matches; rotation pauses while the pointer
// is over it.
export function HeroShowcase({ items, exploreHref }: { items: ShowcaseItem[]; exploreHref: string }) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = items[index];

  // One stable slide object per match and mode — HeroMap re-animates only
  // when the slide it receives actually changes.
  const slides: HeroSlide[] = useMemo(
    () =>
      items.map((item) => {
        const colors = getMatchColors(item.match, theme);
        return { countries: item.countries, homeColor: colors.home, awayColor: colors.away };
      }),
    [items, theme]
  );

  useEffect(() => {
    if (paused || items.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, items.length]);

  return (
    <section className="relative flex flex-col md:min-h-[calc(100svh-3rem)]">
      <div className="z-10 flex flex-col items-start gap-4 px-5 pb-2 pt-6 md:absolute md:bottom-[5vh] md:left-[2.4vw] md:gap-5 md:p-0">
        <h1 className="font-display text-[clamp(2.1rem,3.1vw,3.75rem)] uppercase leading-[0.92] tracking-[-0.02em]">
          The world
          <br />
          is taking
          <br />
          <span className="text-accent">sides.</span>
        </h1>
        <p className="max-w-[19rem] text-[15px] leading-snug text-muted md:max-w-[17rem]">
          Back your team and watch your country light up in its colors.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href={`/match/${current.match.id}`}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Show your support
          </Link>
          <Link href={exploreHref} className="text-sm font-medium text-fg hover:text-accent">
            All matches <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {/* Phones: the box is only as tall as the world is at this width (plus
          room for the caption). A taller box would force Mapbox to zoom in
          and crop the continents. */}
      <div className="relative h-[calc(51vw+104px)] md:absolute md:inset-0 md:h-auto">
        <div className="absolute inset-0">
          <HeroMap slide={slides[index]} />
        </div>

        <div
          className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-4"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
        >
          {/* key → the caption fades in fresh for each match */}
          <MatchCaption key={current.match.id} match={current.match} />

          {items.length > 1 && (
            <div className="flex gap-2" role="tablist" aria-label="Featured matches">
              {items.map((item, i) => (
                <button
                  key={item.match.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`${item.match.home_team.name} vs ${item.match.away_team.name}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-accent ${
                    i === index ? "w-6 bg-fg" : "w-1.5 bg-fg/25 hover:bg-fg/50"
                  }`}
                />
              ))}
            </div>
          )}

          {current.isIllustrative && <p className="text-[11px] text-muted">Illustrative map · real results appear as votes come in</p>}
        </div>
      </div>
    </section>
  );
}

function MatchCaption({ match }: { match: MatchWithTeams }) {
  const kickoff = useKickoffLabel(match.kickoff_at);
  return (
    <Link
      href={`/match/${match.id}`}
      className="flex max-w-full animate-[fadeIn_0.5s_ease-out] items-center gap-3 rounded-full border border-line bg-glass py-1.5 pl-1.5 pr-4 text-sm shadow-float backdrop-blur-xl transition-colors hover:border-fg/25 motion-reduce:animate-none"
    >
      <TeamBadge team={match.home_team} size={26} />
      {/* Short names on phones so the caption never overflows the screen. */}
      <span className="font-semibold sm:hidden">
        {match.home_team.short_name} <span className="font-normal text-muted">vs</span> {match.away_team.short_name}
      </span>
      <span className="hidden truncate font-semibold sm:inline">
        {match.home_team.name} <span className="font-normal text-muted">vs</span> {match.away_team.name}
      </span>
      <TeamBadge team={match.away_team} size={26} />
      <span className="hidden text-xs text-muted sm:inline">{kickoff}</span>
    </Link>
  );
}
