"use client";

import { useState } from "react";
import { getVoterSeed, rememberMyVote, useMyVoteForMatch } from "@/lib/voter";
import { dispatchVoteCast } from "@/lib/voteCastEvent";

export type VoteStatus = "idle" | "pending" | "voted" | "duplicate" | "error";

// Everything about casting a vote for one match. This is the ONLY code in
// the app that submits a vote, and it's only called from the two team
// buttons inside a match card (MatchCard.tsx). "View map", the card itself
// and the map never call it — that's how the "selecting a match must never
// vote" rule (dev-prompt-chatgpt.md "CRITICAL INTERACTION RULES") is
// guaranteed by structure, not just by testing.
//
// A vote means "the team I support", not a prediction.
//
// `onVoted` runs only after the server confirmed the vote (used to show
// that match on the map, so you see your country change).
export function useVote(matchId: string, onVoted?: () => void) {
  const [status, setStatus] = useState<VoteStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Team this device already voted for in this match (from localStorage,
  // see lib/voter.ts) — survives match switches and reloads.
  const myVoteTeamId = useMyVoteForMatch(matchId);

  async function vote(teamId: string) {
    if (myVoteTeamId !== null || status === "pending") return;

    setStatus("pending");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, teamId, voterSeed: getVoterSeed() }),
      });

      if (response.status === 409) {
        // Already voted from this device/network (e.g. storage cleared).
        // Expected behaviour, not a crash — dev-prompt "DUPLICATE VOTES".
        setStatus("duplicate");
        return;
      }
      if (!response.ok) {
        // Show the server's reason when it gives one (e.g. "Could not
        // determine your country." when FANMAP_DEV_COUNTRY is missing
        // locally) — a generic "try again" hides fixable problems.
        const body = await response.json().catch(() => null);
        setErrorMessage(typeof body?.message === "string" ? body.message : null);
        setStatus("error");
        return;
      }

      // Only after the server confirmed: a failed vote must never show as
      // selected.
      rememberMyVote(matchId, teamId);
      dispatchVoteCast(matchId);
      setStatus("voted");
      onVoted?.();
    } catch {
      // No response at all: offline or the server is unreachable.
      setErrorMessage("No connection — check your internet and try again.");
      setStatus("error");
    }
  }

  return { status, errorMessage, myVoteTeamId, vote };
}
