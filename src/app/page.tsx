import { getVisibleMatches } from "@/lib/queries";
import { MatchExperience } from "@/components/MatchExperience";

// Home page per dev-prompt-chatgpt.md "HOME PAGE": hero + the live match
// experience right below it, defaulting to the featured match (or the
// first one) rather than a separate static landing screen — see
// docs/decisions-log.md for why a second, parallel "demo-only" view wasn't
// built for MVP: it would duplicate everything MatchExperience already
// does.
//
// This page must always show the current match list and vote counts, so it
// can't be statically prerendered (Next.js 16's Cache Components feature
// defaults every route to that unless told otherwise). `instant = false`
// opts this route out in favor of a normal per-request render.
export const instant = false;

export default async function HomePage() {
  const matches = await getVisibleMatches();
  const initialMatch = matches.find((m) => m.is_featured) ?? matches[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 px-6 py-6 text-center sm:py-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          Global Fan Map
        </h1>
        <p className="mx-auto mt-1 max-w-xl text-sm text-zinc-400 sm:text-base">
          See which countries support your club.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        {initialMatch ? (
          <MatchExperience matches={matches} initialSelectedMatchId={initialMatch.id} />
        ) : (
          <p className="p-6 text-zinc-400">
            No matches yet — check back soon, or see docs/idea.md for the cold-start plan.
          </p>
        )}
      </div>
    </div>
  );
}
