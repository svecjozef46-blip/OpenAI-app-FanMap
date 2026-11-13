"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MatchWithTeams } from "@/lib/types";
import { HeroMap, type HeroSlide } from "@/components/HeroMap";
import { TeamBadge } from "@/components/TeamBadge";
import { useKickoffLabel } from "@/lib/format";

export type ShowcaseItem = { match: MatchWithTeams; slide: HeroSlide; isIllustrative: boolean };

const ROTATE_MS = 7000;

// Landing-page hero: full-screen world map that rotates through the
// featured matches (set "Featured" in /admin), re-coloring the world for
// each one. Dots let visitors jump to a match; rotation pauses while the
// pointer is over the headline so it doesn't change under someone reading.
export function HeroShowcase({ items, exploreHref }: { items: ShowcaseItem[]; exploreHref: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = items[index];

  useEffect(() => {
    if (paused || items.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, items.length]);

  return (
    <section className="relative isolate flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-end overflow-hidden px-4 pb-14 sm:pb-20">
      <div className="absolute inset-0 -z-10">
        <HeroMap slide={current.slide} />
        {/* Darken the lower part so the headline stays readable on top of the map. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_80%,rgba(9,9,11,0.92),rgba(9,9,11,0.5)_60%,transparent)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-zinc-950 to-transparent" />
      </div>

      <div
        className="flex max-w-2xl flex-col items-center text-center"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl">Global Fan Map</h1>
        <p className="mt-4 text-lg text-zinc-300 sm:text-xl">See which countries support your club.</p>

        <div className="mt-8 flex flex-col items-center gap-5">
          {/* key → the chip fades in fresh for each match */}
          <MatchChip key={current.match.id} match={current.match} />
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={`/match/${current.match.id}`}
              className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Show your support
            </Link>
            <Link
              href={exploreHref}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 font-semibold text-zinc-100 backdrop-blur transition hover:bg-white/10"
            >
              Explore matches →
            </Link>
          </div>

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
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {current.isIllustrative && (
        <p className="absolute inset-x-0 bottom-3 text-center text-[11px] text-zinc-500">
          Illustrative map — real results appear as votes come in.
        </p>
      )}
    </section>
  );
}

function MatchChip({ match }: { match: MatchWithTeams }) {
  const kickoff = useKickoffLabel(match.kickoff_at);
  return (
    <div className="flex animate-[fadeIn_0.5s_ease-out] items-center gap-3 rounded-full border border-white/10 bg-zinc-950/70 py-1.5 pl-1.5 pr-4 text-sm backdrop-blur motion-reduce:animate-none">
      <TeamBadge team={match.home_team} size={26} />
      {/* Short names on phones so the chip never overflows the screen. */}
      <span className="font-semibold text-zinc-50 sm:hidden">
        {match.home_team.short_name} <span className="font-normal text-zinc-500">vs</span> {match.away_team.short_name}
      </span>
      <span className="hidden font-semibold text-zinc-50 sm:inline">
        {match.home_team.name} <span className="font-normal text-zinc-500">vs</span> {match.away_team.name}
      </span>
      <TeamBadge team={match.away_team} size={26} />
      <span className="hidden text-xs text-zinc-500 sm:inline">{kickoff}</span>
    </div>
  );
}
