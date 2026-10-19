// Client-side helpers for the MVP-level anti-spam / "did I already vote"
// story. See docs/tech-stack.md: "kombinácia cookie (zariadenie) + hash IP
// adresy... pre B2B neskôr treba niečo silnejšie" — this is deliberately a
// device-level, not identity-level, check. Clearing localStorage resets it;
// that's a known, documented MVP limitation, not an oversight.
"use client";

import { useSyncExternalStore } from "react";

const SEED_KEY = "fanmap_voter_seed";
const VOTES_KEY = "fanmap_my_votes";

// A random per-device seed, created once and reused forever. The server
// combines this with the request's IP + user-agent to compute the actual
// voter_hash (see src/app/api/votes/route.ts) — the seed alone is not the
// hash, so a client can't forge a different device's vote by guessing it.
export function getVoterSeed(): string {
  let seed = localStorage.getItem(SEED_KEY);
  if (!seed) {
    seed = crypto.randomUUID();
    localStorage.setItem(SEED_KEY, seed);
  }
  return seed;
}

type MyVotes = Record<string, string>; // matchId -> teamId

function readMyVotes(): MyVotes {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    return raw ? (JSON.parse(raw) as MyVotes) : {};
  } catch {
    // Corrupted or blocked storage shouldn't break voting — just behave as
    // if nothing was recorded yet.
    return {};
  }
}

// Which team (if any) this device has already voted for in a given match.
// Used to restore the "voted" UI state after a reload or when switching
// back to a previously-viewed match (dev-prompt-chatgpt.md acceptance
// tests #5 and #8).
export function getMyVoteForMatch(matchId: string): string | null {
  return readMyVotes()[matchId] ?? null;
}

// Listeners notified whenever a vote is recorded, so every VoteButton on
// screen re-reads its "have I voted" state immediately — not just the one
// that was clicked (e.g. if the same match's row somehow renders twice).
// This is the subscribe side of the useSyncExternalStore store below.
const listeners = new Set<() => void>();

export function rememberMyVote(matchId: string, teamId: string): void {
  const votes = readMyVotes();
  votes[matchId] = teamId;
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  for (const listener of listeners) listener();
}

// React hook wrapping getMyVoteForMatch(). Reading localStorage directly in
// a component's render body would mismatch between server-rendered HTML
// (no `window`, so nothing voted) and the client's first paint (localStorage
// available immediately) — a real hydration bug, not a theoretical one.
// useSyncExternalStore is React's documented tool for exactly this: an
// external (non-React) store that both needs a server snapshot and can
// change over time (here, whenever rememberMyVote() runs).
export function useMyVoteForMatch(matchId: string): string | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => getMyVoteForMatch(matchId),
    () => null
  );
}
