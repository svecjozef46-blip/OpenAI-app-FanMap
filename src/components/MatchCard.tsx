"use client";

import Link from "next/link";
import type { MatchTotals, MatchWithTeams, Team } from "@/lib/types";
import { TeamBadge } from "@/components/TeamBadge";
import { SupportBar } from "@/components/SupportBar";
import { splitPercent, useKickoffLabel } from "@/lib/format";
import { getMatchColors } from "@/lib/teamColors";
import { useTheme } from "@/lib/theme";
import { useVote } from "@/lib/useVote";

const STATUS: Record<MatchWithTeams["status"], { label: string; dot: string }> = {
  upcoming: { label: "Upcoming", dot: "bg-sky-500" },
  live: { label: "Live", dot: "bg-accent motion-safe:animate-pulse" },
  finished: { label: "Finished", dot: "bg-faint" },
  archived: { label: "Archived", dot: "bg-faint" },
};

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
  const kickoff = useKickoffLabel(match.kickoff_at);
  const { homePct, isEmpty } = splitPercent(totals?.home ?? 0, totals?.away ?? 0);
  const canVote = myVoteTeamId === null && status !== "pending" && match.status !== "archived";
  const matchStatus = STATUS[match.status];

  let note: { text: string; isError: boolean };
  if (status === "pending") note = { text: "Saving…", isError: false };
  else if (status === "duplicate") note = { text: "Already counted from this device", isError: false };
  else if (status === "error") note = { text: errorMessage ?? "Couldn't save — try again", isError: true };
  else if (myVoteTeamId === null) note = { text: "Tap the team you support", isError: false };
  else note = { text: isEmpty ? "No votes yet" : `${homePct}% · ${100 - homePct}%`, isError: false };

  return (
    <div
      className={`flex w-full flex-col gap-2.5 rounded-2xl border p-3 transition-colors ${
        isSelected ? "border-fg/25 bg-raised" : "border-transparent bg-surface"
      }`}
    >
      <div className="flex items-center justify-between px-1 text-[11px] font-medium uppercase tracking-wide">
        <span className="flex items-center gap-1.5 text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${matchStatus.dot}`} aria-hidden="true" />
          {matchStatus.label}
          {isTrending && <span className="ml-1 normal-case text-warn">↗ Trending</span>}
        </span>
        <span className="normal-case tracking-normal text-muted">{kickoff}</span>
      </div>

      <div className="flex items-center gap-2">
        <SupportButton
          team={match.home_team}
          isMine={myVoteTeamId === match.home_team_id}
          dimmed={myVoteTeamId !== null && myVoteTeamId !== match.home_team_id}
          disabled={!canVote}
          onVote={() => vote(match.home_team_id)}
        />
        <span className="text-xs text-faint">vs</span>
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
        <span role="status" className={`truncate ${note.isError ? "text-danger" : "text-muted"}`}>
          {note.text}
        </span>
        <button
          type="button"
          onClick={() => onSelect(match.id)}
          aria-pressed={isSelected}
          className={`shrink-0 rounded-full px-3 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
            isSelected ? "bg-fg/10 text-fg" : "text-muted hover:bg-fg/[0.07] hover:text-fg"
          }`}
        >
          {isSelected ? "On the map" : "View map ›"}
        </button>
      </div>
    </div>
  );
}

// Large read-only tile that links to the match page (home page). No vote
// buttons here: buttons can't live inside a link, and the home page is for
// browsing.
export function MatchLinkCard({
  match,
  totals,
  leagueName,
}: {
  match: MatchWithTeams;
  totals: MatchTotals | undefined;
  leagueName: string | undefined;
}) {
  const kickoff = useKickoffLabel(match.kickoff_at);
  const { homePct, isEmpty } = splitPercent(totals?.home ?? 0, totals?.away ?? 0);
  return (
    <Link
      href={`/match/${match.id}`}
      className="group flex h-full flex-col gap-6 rounded-2xl bg-surface p-6 transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent sm:p-7"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span className="truncate font-medium">{leagueName}</span>
        <span className="shrink-0">{kickoff}</span>
      </div>
      <div className="flex flex-col gap-3">
        <TeamRow team={match.home_team} />
        <TeamRow team={match.away_team} />
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <CardBar match={match} homePct={homePct} isEmpty={isEmpty} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{isEmpty ? "No votes yet" : `${homePct}% · ${100 - homePct}%`}</span>
          <span className="font-medium text-accent group-hover:underline">
            Show your support <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function TeamRow({ team }: { team: Team }) {
  return (
    <div className="flex items-center gap-3">
      <TeamBadge team={team} size={36} />
      <span className="truncate text-xl font-semibold tracking-tight">{team.name}</span>
    </div>
  );
}

function CardBar({ match, homePct, isEmpty }: { match: MatchWithTeams; homePct: number; isEmpty: boolean }) {
  const colors = getMatchColors(match, useTheme());
  return <SupportBar homePct={homePct} homeColor={colors.home} awayColor={colors.away} isEmpty={isEmpty} height={4} />;
}

// One team's "I support this team" button. The supported team gets a green
// outline and a green check — clear and persistent (also after switching
// matches or reloading); the other team fades back.
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
      } ${isMine ? "border-accent bg-accent/10" : "border-line bg-bg/60"} ${dimmed ? "opacity-40" : ""} ${
        disabled ? "cursor-default" : "cursor-pointer hover:border-fg/30 hover:bg-bg"
      } focus-visible:outline-2 focus-visible:outline-accent`}
    >
      <span className={`shrink-0 transition-transform ${disabled ? "" : "group-hover:scale-105"}`}>
        <TeamBadge team={team} size={28} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{team.short_name}</span>
      {isMine && <CheckIcon />}
    </button>
  );
}

export function CheckIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-bg">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
