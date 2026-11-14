import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { FIXTURE, supabaseRest } from "./helpers.ts";

// Database security (Row Level Security), checked by talking to Supabase
// directly with the public anon key — i.e. what anyone on the internet can
// do without going through our app at all.

test("anonymous visitors cannot read individual votes", async () => {
  const response = await supabaseRest("votes?select=*&limit=5");
  // RLS answers with an empty list (or a permission error) — never rows.
  const rows = response.ok ? await response.json() : [];
  assert.deepEqual(rows, []);
});

test("anonymous visitors cannot insert a vote directly into the table", async () => {
  const response = await supabaseRest("votes", {
    method: "POST",
    body: JSON.stringify({
      match_id: FIXTURE.openMatchId,
      team_id: FIXTURE.homeTeamId,
      country_code: "SK",
      voter_hash: `direct-${randomUUID()}`,
    }),
  });
  assert.ok([401, 403].includes(response.status), `expected 401/403, got ${response.status}`);
});

test("anonymous visitors cannot change or delete votes", async () => {
  for (const method of ["PATCH", "DELETE"]) {
    const response = await supabaseRest(`votes?match_id=eq.${FIXTURE.openMatchId}`, {
      method,
      headers: { Prefer: "return=representation" },
      body: method === "PATCH" ? JSON.stringify({ country_code: "XX" }) : undefined,
    });
    const rows = response.ok ? await response.json() : [];
    assert.deepEqual(rows, [], `${method} must not touch any vote`);
  }
});

test("anonymous visitors cannot edit matches, teams or leagues", async () => {
  const attempts: Array<[string, object]> = [
    [`matches?id=eq.${FIXTURE.openMatchId}`, { status: "finished" }],
    [`teams?id=eq.${FIXTURE.homeTeamId}`, { name: "Hacked" }],
    ["leagues?slug=eq.premier-league", { name: "Hacked" }],
  ];
  for (const [path, change] of attempts) {
    const response = await supabaseRest(path, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(change),
    });
    const rows = response.ok ? await response.json() : [];
    assert.deepEqual(rows, [], `PATCH ${path} must not change anything`);
  }
  const stillOpen = await (await supabaseRest(`matches?id=eq.${FIXTURE.openMatchId}&select=status`)).json();
  assert.equal(stillOpen[0].status, "upcoming");
});

test("anonymous visitors cannot create a match", async () => {
  const response = await supabaseRest("matches", {
    method: "POST",
    body: JSON.stringify({
      league_id: "00000000-0000-4000-a000-000000000001",
      home_team_id: FIXTURE.homeTeamId,
      away_team_id: FIXTURE.awayTeamId,
      kickoff_at: "2099-01-01T00:00:00Z",
    }),
  });
  assert.ok([401, 403].includes(response.status), `expected 401/403, got ${response.status}`);
});

test("the admin list is invisible to anonymous visitors", async () => {
  const response = await supabaseRest("admin_users?select=*");
  const rows = response.ok ? await response.json() : [];
  assert.deepEqual(rows, []);
});

test("vote results are readable only as totals, without voter details", async () => {
  const response = await supabaseRest(`match_results?match_id=eq.${FIXTURE.openMatchId}`);
  assert.equal(response.status, 200);
  for (const row of await response.json()) {
    assert.deepEqual(Object.keys(row).sort(), ["country_code", "match_id", "team_id", "vote_count"]);
  }
});

// submit_vote() is the one database function the public may call.
const submitVote = (args: object) => supabaseRest("rpc/submit_vote", { method: "POST", body: JSON.stringify(args) });

test("submit_vote refuses a team that isn't playing in the match", async () => {
  const response = await submitVote({
    p_match_id: FIXTURE.openMatchId,
    p_team_id: randomUUID(),
    p_country_code: "SK",
    p_voter_hash: `rpc-${randomUUID()}`,
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /not part of this match/);
});

test("submit_vote refuses a finished match", async () => {
  const response = await submitVote({
    p_match_id: FIXTURE.finishedMatchId,
    p_team_id: FIXTURE.homeTeamId,
    p_country_code: "SK",
    p_voter_hash: `rpc-${randomUUID()}`,
  });
  assert.ok(!response.ok);
  assert.equal((await response.json()).code, "VC001");
});

test("submit_vote refuses a match that doesn't exist", async () => {
  const response = await submitVote({
    p_match_id: randomUUID(),
    p_team_id: FIXTURE.homeTeamId,
    p_country_code: "SK",
    p_voter_hash: `rpc-${randomUUID()}`,
  });
  assert.equal(response.status, 400);
});
