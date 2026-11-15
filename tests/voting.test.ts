import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { FIXTURE, TURNSTILE_ON, postVote } from "./helpers.ts";

// The voting flow through the app's API (/api/votes). Needs the app
// running locally (`npm run dev`, with FANMAP_DEV_COUNTRY set in
// .env.local). Votes go to the hidden "Internal tests" match only, never
// to a real one.

// A fresh "device" for each test run, so runs don't collide with each other.
const voterSeed = `test-${randomUUID()}`;

test("a first vote is accepted", async () => {
  const response = await postVote({ matchId: FIXTURE.openMatchId, teamId: FIXTURE.homeTeamId, voterSeed });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.vote.match_id, FIXTURE.openMatchId);
  assert.equal(body.vote.team_id, FIXTURE.homeTeamId);
});

test("a second vote from the same device is rejected as a duplicate", async () => {
  const response = await postVote({ matchId: FIXTURE.openMatchId, teamId: FIXTURE.homeTeamId, voterSeed });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "already_voted");
});

test("switching to the other team after voting is rejected too", async () => {
  const response = await postVote({ matchId: FIXTURE.openMatchId, teamId: FIXTURE.awayTeamId, voterSeed });
  assert.equal(response.status, 409);
});

// The fixture match from 2020 is finished — or archived, once
// rotate_matches() has run; either way voting on it is closed.
test("a vote on a finished or archived match is rejected with a clear message", async () => {
  const response = await postVote({
    matchId: FIXTURE.finishedMatchId,
    teamId: FIXTURE.homeTeamId,
    voterSeed: `test-${randomUUID()}`,
  });
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "voting_closed");
  assert.match(body.message, /closed/i);
});

test("a vote for a team that isn't playing in the match is rejected", async () => {
  const response = await postVote({
    matchId: FIXTURE.openMatchId,
    teamId: randomUUID(),
    voterSeed: `test-${randomUUID()}`,
  });
  assert.equal(response.status, 400);
});

test("a vote on a match that doesn't exist is rejected", async () => {
  const response = await postVote({
    matchId: randomUUID(),
    teamId: FIXTURE.homeTeamId,
    voterSeed: `test-${randomUUID()}`,
  });
  assert.equal(response.status, 400);
});

test("a malformed request is rejected with a readable message, not a crash", async () => {
  for (const body of ["not json", { matchId: "abc", teamId: "def", voterSeed: "x" }, {}]) {
    const response = await postVote(body);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).message, "string");
  }
});

// Human check (Cloudflare Turnstile): a visitor's vote needs a valid token.
// Skipped when the app runs without TURNSTILE_SECRET_KEY (check is off).
const freshVote = () => ({
  matchId: FIXTURE.openMatchId,
  teamId: FIXTURE.homeTeamId,
  voterSeed: `test-${randomUUID()}`,
});

test("a vote without the human-check token is rejected", { skip: !TURNSTILE_ON }, async () => {
  const response = await postVote(freshVote(), { asVisitor: true });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "verification_failed");
});

test("a vote with a made-up human-check token is rejected", { skip: !TURNSTILE_ON }, async () => {
  const response = await postVote({ ...freshVote(), turnstileToken: "made-up-token" }, { asVisitor: true });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "verification_failed");
});

test("a wrong test secret gets no special treatment", { skip: !TURNSTILE_ON }, async () => {
  const response = await postVote(freshVote(), { testSecret: "guess" });
  assert.equal(response.status, 403);
});
