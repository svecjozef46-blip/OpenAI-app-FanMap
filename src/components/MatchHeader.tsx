"use client";

import type { CountryResult, MatchWithTeams, Team } from "@/lib/types";
import { TeamBadge } from "@/components/TeamBadge";
import { SupportBar } from "@/components/SupportBar";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { CheckIcon } from "@/components/MatchCard";
import { splitPercent } from "@/lib/format";
import { hexToRgba } from "@/lib/mapSetup";
import { getMatchColors } from "@/lib/teamColors";
import { useTheme } from "@/lib/theme";
import { useMyVoteForMatch } from "@/lib/voter";

// The slim bar above the map: the selected match's live totals and split.
// Display only — votes are cast in the match cards (MatchCard.tsx), so
// nothing here reacts to clicks. The team you support gets the same green
// check as in its card.
//
// Kept to a single compact row on purpose: the map is the product, this
// shouldn't cover it. Layout per dev-prompt-chatgpt.md "MATCH HEADER":
//   [badge name  count] [ % ===bar=== % ] [count  name badge]
// CSS Grid `1fr | bar | 1fr` keeps the bar centred whatever the name
// lengths; names truncate first, then the bar shrinks — counts never clip.
export function MatchHeader({
  match,
  results,
}: {
  match: MatchWithTeams;
  results: CountryResult[];
}) {
  const myVoteTeamId = useMyVoteForMatch(match.id);
  const colors = getMatchColors(match, useTheme());

  const homeVotes = results.reduce((sum, r) => sum + r.homeVotes, 0);
  const awayVotes = results.reduce((sum, r) => sum + r.awayVotes, 0);
  const { homePct, awayPct, isEmpty } = splitPercent(homeVotes, awayVotes);

  const supportedTeam =
    myVoteTeamId === match.home_team_id
      ? match.home_team
      : myVoteTeamId === match.away_team_id
        ? match.away_team
        : null;

  // `short` is shown on phones, where the space under the bar is narrow.
  const message = supportedTeam
    ? { text: `You support ${supportedTeam.short_name}`, short: "Your team ✓", good: true }
    : isEmpty
      ? { text: "No votes yet — vote in the match list", short: "No votes yet", good: false }
      : { text: "Vote for your team in the match list", short: "Vote in the list", good: false };

  return (
    <div
      className="rounded-2xl border border-line bg-glass shadow-float backdrop-blur-xl"
      style={{
        backgroundImage: `linear-gradient(90deg, ${hexToRgba(colors.home, 0.14)}, transparent 30%, transparent 70%, ${hexToRgba(colors.away, 0.14)})`,
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(56px,0.8fr)_minmax(0,1fr)] items-center gap-2 p-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(120px,220px)_minmax(0,1fr)] sm:gap-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <TeamLabel team={match.home_team} side="home" isMine={myVoteTeamId === match.home_team_id} />
          <span className="shrink-0 text-base font-semibold tracking-tight sm:text-lg">
            <AnimatedNumber value={homeVotes} />
          </span>
        </div>

        <div className="flex flex-col gap-1">
          {/* Percentages in the text color (not team colors): a yellow or
              white kit would be unreadable as text in one of the modes. The
              bar below carries the colors. */}
          <div className={`flex justify-between text-[11px] font-semibold tabular-nums ${isEmpty ? "text-muted" : ""}`}>
            <span>{homePct}%</span>
            <span>{awayPct}%</span>
          </div>
          <SupportBar homePct={homePct} homeColor={colors.home} awayColor={colors.away} isEmpty={isEmpty} height={5} />
          <p className={`truncate text-center text-[11px] leading-4 ${message.good ? "text-accent" : "text-muted"}`}>
            <span className="sm:hidden">{message.short}</span>
            <span className="hidden sm:inline">{message.text}</span>
          </p>
        </div>

        <div className="flex min-w-0 flex-row-reverse items-center justify-between gap-2">
          <TeamLabel team={match.away_team} side="away" isMine={myVoteTeamId === match.away_team_id} />
          <span className="shrink-0 text-base font-semibold tracking-tight sm:text-lg">
            <AnimatedNumber value={awayVotes} />
          </span>
        </div>
      </div>
    </div>
  );
}

// Badge + name; the team you support gets a green check.
function TeamLabel({ team, side, isMine }: { team: Team; side: "home" | "away"; isMine: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 px-1 py-1 sm:gap-2.5 ${side === "away" ? "flex-row-reverse text-right" : ""}`}>
      <span className="shrink-0">
        <TeamBadge team={team} size={32} />
      </span>
      {/* Short name on phones, full name from the sm breakpoint up. */}
      <span className="min-w-0 truncate text-sm font-semibold sm:hidden">{team.short_name}</span>
      <span className="hidden min-w-0 truncate text-[15px] font-semibold tracking-tight sm:block">{team.name}</span>
      {isMine && <CheckIcon />}
    </div>
  );
}
