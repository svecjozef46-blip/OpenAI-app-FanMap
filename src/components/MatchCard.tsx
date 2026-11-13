"use client";

import Link from "next/link";
import type { MatchTotals, MatchWithTeams, Team } from "@/lib/types";
import { TeamBadge } from "@/components/TeamBadge";
import { SupportBar } from "@/components/SupportBar";
import { splitPercent, useKickoffLabel } from "@/lib/format";
import { getMatchColors } from "@/lib/teamColors";
import { useVote } from "@/lib/useVote";

const STATUS: Record<MatchWithTeams["status"], { label: string; dot: string }> = {
  upcoming: { label: "Upcoming", dot: "bg-sky-400" },
  live: { label: "Live", dot: "bg-emerald-400 motion-safe:animate-pulse" },
  finished: { label: "Finished", dot: "bg-zinc-500" },
  archived: { label: "Archived", dot: "bg-zinc-700" },
};

const cardBase = "flex w-full flex-col gap-2.5 rounded-2xl border p-3 text-left transition-colors";

// Match card in the match list — the place where people vote.
//
// dev-prompt-chatgpt.md "CRITICAL INTERACTION RULES": the card itself has
// NO click handler. It contains three separate, non-nested buttons:
//   - home team  → vote for (support) the home team
//   - away team  → vote for (support) the away team
//   - "View map" → only selects the match, never votes
// so a tap meant for one can never trigger another. After a successful
// vote the card also shows that match on the map (onSelect), so you see
// your vote land.
export function MatchCard({
  match,
  totals,
  isSelected,
  isTrending,
  onSelect,
}: {
  match: MatchWithTeams;
  totals: MatchTotals | undefined;
  isSelected: boolean;
  isTrending: boolean;
  onSelect: (matchId: string) => void;
}) {
  const { status, errorMessage, myVoteTeamId, vote } = useVote(match.id, () => onSelect(match.id));
  const { homePct, isEmpty } = splitPercent(totals?.home ?? 0, totals?.away ?? 0);
  const canVote = myVoteTeamId === null && status !== "pending" && match.status !== "archived";

  let note: { text: string; tone: "muted" | "good" | "bad" };
  if (status === "pending") note = { text: "Saving…", tone: "muted" };
  else if (status === "duplicate") note = { text: "Already counted from this device", tone: "muted" };
  else if (status === "error") note = { text: errorMessage ?? "Couldn't save — try again", tone: "bad" };
  else if (myVoteTeamId === null) note = { text: "Tap the team you support", tone: "muted" };
  else note = { text: isEmpty ? "No votes yet" : `${homePct}% · ${100 - homePct}%`, tone: "muted" };

  return (
    <div
      className={`${cardBase} ${
        isSelected ? "border-white/20 bg-white/[0.06]" : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <CardTop match={match} isTrending={isTrending} />

      <div className="flex items-center gap-2">
        <SupportButton
          team={match.home_team}
          isMine={myVoteTeamId === match.home_team_id}
          dimmed={myVoteTeamId !== null && myVoteTeamId !== match.home_team_id}
          disabled={!canVote}
          onVote={() => vote(match.home_team_id)}
        />
        <span className="text-xs text-zinc-600">vs</span>
        <SupportButton
          team={match.away_team}
          side="away"
          isMine={myVoteTeamId === match.away_team_id}
          dimmed={myVoteTeamId !== null && myVoteTeamId !== match.away_team_id}
          disabled={!canVote}
          onVote={() => vote(match.away_team_id)}
        />
      </div>

      <CardBar match={match} homePct={homePct} isEmpty={isEmpty} />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          role="status"
          className={`truncate ${
            note.tone === "bad" ? "text-red-400" : note.tone === "good" ? "text-emerald-400" : "text-zinc-500"
          }`}
        >
          {note.text}
        </span>
        <button
          type="button"
          onClick={() => onSelect(match.id)}
          aria-pressed={isSelected}
          className={`shrink-0 rounded-full px-3 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-emerald-400 ${
            isSelected
              ? "bg-white/10 text-zinc-100"
              : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
          }`}
        >
          {isSelected ? "On the map" : "View map →"}
        </button>
      </div>
    </div>
  );
}

// Read-only card that links to the match page (landing page). No vote
// buttons here: buttons can't live inside a link, and the landing page is
// for browsing.
export function MatchLinkCard({ match, totals }: { match: MatchWithTeams; totals: MatchTotals | undefined }) {
  const { homePct, isEmpty } = splitPercent(totals?.home ?? 0, totals?.away ?? 0);
  return (
    <Link
      href={`/match/${match.id}`}
      className={`${cardBase} group border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-emerald-400`}
    >
      <CardTop match={match} isTrending={false} />
      <div className="flex items-center gap-2 px-1">
        <TeamBadge team={match.home_team} size={26} />
        <span className="truncate font-semibold text-zinc-100">{match.home_team.name}</span>
        <span className="flex-1 text-center text-xs text-zinc-600">vs</span>
        <span className="truncate text-right font-semibold text-zinc-100">{match.away_team.name}</span>
        <TeamBadge team={match.away_team} size={26} />
      </div>
      <CardBar match={match} homePct={homePct} isEmpty={isEmpty} />
      <div className="flex justify-between text-xs">
        <span className="text-zinc-500">{isEmpty ? "No votes yet" : `${homePct}% · ${100 - homePct}%`}</span>
        <span className="text-zinc-400 group-hover:text-zinc-100">Show your support →</span>
      </div>
    </Link>
  );
}

function CardTop({ match, isTrending }: { match: MatchWithTeams; isTrending: boolean }) {
  const kickoff = useKickoffLabel(match.kickoff_at);
  const status = STATUS[match.status];
  return (
    <div className="flex items-center justify-between px-1 text-[11px] font-medium uppercase tracking-wide">
      <span className="flex items-center gap-1.5 text-zinc-400">
        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
        {status.label}
        {isTrending && <span className="ml-1 normal-case text-amber-400">↗ Trending</span>}
      </span>
      <span className="normal-case tracking-normal text-zinc-500">{kickoff}</span>
    </div>
  );
}

function CardBar({ match, homePct, isEmpty }: { match: MatchWithTeams; homePct: number; isEmpty: boolean }) {
  const colors = getMatchColors(match);
  return <SupportBar homePct={homePct} homeColor={colors.home} awayColor={colors.away} isEmpty={isEmpty} height={4} />;
}

// One team's "I support this team" button. The supported team gets a green
// outline, soft glow and a green check — clear and persistent (also after
// switching matches or reloading); the other team fades back.
function SupportButton({
  team,
  side = "home",
  isMine,
  dimmed,
  disabled,
  onVote,
}: {
  team: Team;
  side?: "home" | "away";
  isMine: boolean;
  dimmed: boolean;
  disabled: boolean;
  onVote: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onVote}
      disabled={disabled}
      aria-pressed={isMine}
      aria-label={isMine ? `You support ${team.name}` : `Support ${team.name}`}
      title={isMine ? undefined : `Support ${team.name}`}
      className={`group flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2 py-1.5 transition-all duration-200 ${
        side === "away" ? "flex-row-reverse text-right" : "text-left"
      } ${
        isMine
          ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.18)]"
          : "border-white/[0.08] bg-white/[0.02]"
      } ${dimmed ? "opacity-40" : ""} ${
        disabled ? "cursor-default" : "cursor-pointer hover:border-white/25 hover:bg-white/[0.07]"
      } focus-visible:outline-2 focus-visible:outline-emerald-400`}
    >
      <span className={`shrink-0 transition-transform ${disabled ? "" : "group-hover:scale-105"}`}>
        <TeamBadge team={team} size={28} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-50">{team.short_name}</span>
      {isMine && <CheckIcon />}
    </button>
  );
}

function CheckIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2.5 6.2 5 8.6l4.5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
