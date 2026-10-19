// A plain DOM CustomEvent, not a state-management library, carries the
// "a vote was just cast" signal from VoteButton (nested inside the match
// sidebar) up to MatchExperience (which owns the map and header) so results
// refresh immediately after your own vote instead of waiting for the next
// poll. Reaching for Redux/Zustand/Context for one cross-component signal
// in an app this size would be the "unnecessary abstraction"
// dev-prompt-chatgpt.md explicitly warns against; a browser-native event is
// the conventional, boring choice here.
export const VOTE_CAST_EVENT = "fanmap:vote-cast";

export type VoteCastEventDetail = { matchId: string };

export function dispatchVoteCast(matchId: string): void {
  window.dispatchEvent(
    new CustomEvent<VoteCastEventDetail>(VOTE_CAST_EVENT, { detail: { matchId } })
  );
}
