"use client";

import { useState } from "react";
import type { Team } from "@/lib/types";
import { TeamBadge } from "@/components/TeamBadge";
import { getVoterSeed, rememberMyVote, useMyVoteForMatch } from "@/lib/voter";
import { dispatchVoteCast } from "@/lib/voteCastEvent";

type VoteStatus = "idle" | "pending" | "voted" | "duplicate" | "error";

// Casts one vote for `team` in `matchId`. This is the ONLY thing that ever
// submits a vote in this app — see docs/dev-prompt-chatgpt.md "CRITICAL
// INTERACTION RULES": selecting a match (View Map / clicking a match row)
// must never submit a vote, only clicking a team name/logo does. Keeping
// that logic entirely inside this one button (never on a parent row or
// container) is what makes that guarantee easy to verify by reading the
// code, not just by testing it.
export function VoteButton({
  matchId,
  team,
  align = "left",
}: {
  matchId: string;
  team: Team;
  align?: "left" | "right";
}) {
  const [status, setStatus] = useState<VoteStatus>("idle");
  // Which team (if any) this device already voted for in this match — null
  // on the server and on first client paint, then filled in from
  // localStorage after mount. See lib/voter.ts for why it can't be read
  // synchronously here.
  const alreadyVotedForTeamId = useMyVoteForMatch(matchId);

  const hasVotedThisTeam = alreadyVotedForTeamId === team.id;
  const hasVotedOtherTeam =
    alreadyVotedForTeamId !== null && alreadyVotedForTeamId !== team.id;

  async function handleClick(event: React.MouseEvent) {
    // Belt-and-suspenders: even though this button has no parent click
    // handler today, stopping propagation here means that stays true even
    // if MatchRow's layout changes later. See file-level comment above.
    event.stopPropagation();

    if (alreadyVotedForTeamId !== null || status === "pending") {
      return;
    }

    setStatus("pending");
    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          teamId: team.id,
          voterSeed: getVoterSeed(),
        }),
      });

      if (response.status === 409) {
        setStatus("duplicate");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }

      // rememberMyVote() notifies every useMyVoteForMatch subscriber
      // itself (see lib/voter.ts) — no separate refresh call needed.
      rememberMyVote(matchId, team.id);
      dispatchVoteCast(matchId);
      setStatus("voted");
    } catch {
      setStatus("error");
    }
  }

  const isDisabled = alreadyVotedForTeamId !== null || status === "pending";

  return (
    <div className={`flex flex-col gap-1 ${align === "right" ? "items-end" : "items-start"}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-pressed={hasVotedThisTeam}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors ${
          align === "right" ? "flex-row-reverse" : ""
        } ${
          hasVotedThisTeam
            ? "bg-emerald-500/10 ring-1 ring-emerald-400"
            : hasVotedOtherTeam
              ? "opacity-50"
              : "hover:bg-white/10"
        } ${isDisabled ? "cursor-default" : "cursor-pointer"}`}
      >
        <TeamBadge team={team} size={28} />
        <span className="font-medium text-zinc-100">{team.name}</span>
        {hasVotedThisTeam && (
          <span className="text-emerald-400" aria-label="voted">
            ✓
          </span>
        )}
      </button>
      {status === "duplicate" && (
        <p className="text-xs text-zinc-400">Your vote for this match is already recorded.</p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-400">Could not submit vote — try again.</p>
      )}
    </div>
  );
}
