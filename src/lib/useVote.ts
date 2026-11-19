"use client";

import { useEffect, useRef, useState } from "react";
import { getVoterSeed, rememberMyVote, useMyVoteForMatch } from "@/lib/voter";
import { dispatchVoteCast } from "@/lib/voteCastEvent";
import { getTurnstileToken, isTurnstileReady, preloadTurnstile, TurnstileError } from "@/lib/turnstile";

// "verifying" = the human check isn't ready yet; the vote is sent by itself
// the moment it is (neutral state, not an error). "pending" = saving.
export type VoteStatus = "idle" | "verifying" | "pending" | "voted" | "duplicate" | "error";

// What went wrong, so the card can say the right thing and offer a retry
// only where retrying the same vote makes sense:
//  - "verification": the human check was blocked or took too long
//  - "network": no connection / server unreachable
//  - "server": the server answered with a refusal (message from the server)
export type VoteErrorKind = "verification" | "network" | "server";

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
  const [errorKind, setErrorKind] = useState<VoteErrorKind | null>(null);
  // The team of the last attempt, so "Try again" repeats exactly that vote.
  const lastTeamId = useRef<string | null>(null);
  // Team this device already voted for in this match (from localStorage,
  // see lib/voter.ts) — survives match switches and reloads.
  const myVoteTeamId = useMyVoteForMatch(matchId);

  // Fetch the human-check script ahead of time so the first vote is fast.
  useEffect(() => {
    preloadTurnstile();
  }, []);

  async function vote(teamId: string) {
    if (myVoteTeamId !== null || status === "pending" || status === "verifying") return;

    lastTeamId.current = teamId;
    // Token not ready yet (the check takes a while after page load): say so
    // neutrally and send the vote automatically when it arrives.
    setStatus(isTurnstileReady() ? "pending" : "verifying");
    setErrorMessage(null);
    setErrorKind(null);

    // Human check first (Cloudflare Turnstile) — the server refuses a vote
    // without a valid token. Usually invisible; see lib/turnstile.ts.
    let turnstileToken: string | null;
    try {
      turnstileToken = await getTurnstileToken();
    } catch (error) {
      setErrorMessage(
        error instanceof TurnstileError && error.kind === "timeout"
          ? "Verification is taking too long. Try again in a moment."
          : "Verification didn't load — an ad blocker or privacy extension may be blocking it. Allow challenges.cloudflare.com, then try again."
      );
      setErrorKind("verification");
      setStatus("error");
      return;
    }

    setStatus("pending");
    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, teamId, voterSeed: getVoterSeed(), turnstileToken }),
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
        setErrorKind("server");
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
      setErrorKind("network");
      setStatus("error");
    }
  }

  // Repeats the last attempt (used by the "Try again" button).
  function retry() {
    if (lastTeamId.current) void vote(lastTeamId.current);
  }

  return { status, errorMessage, errorKind, myVoteTeamId, vote, retry };
}
