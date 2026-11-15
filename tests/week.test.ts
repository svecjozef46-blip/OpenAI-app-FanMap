import { test } from "node:test";
import assert from "node:assert/strict";
import { weekOf, weekRange, weekStart } from "../src/lib/week.ts";
import { FIXTURE, supabaseRest } from "./helpers.ts";

// The match week (Monday 00:00 to Monday 00:00, Bratislava time) and the
// automatic status changes built on it. See src/lib/week.ts and
// rotate_matches() in docs/schema.sql.

const iso = (d: Date) => d.toISOString();
const HOUR = 60 * 60 * 1000;

// --- src/lib/week.ts -------------------------------------------------------------

test("Sunday 23:59 still belongs to the week, Monday 00:00 starts a new one", () => {
  // Bratislava is UTC+1 in November: Mon 16 Nov 00:00 local = 15 Nov 23:00 UTC.
  assert.equal(iso(weekStart(new Date("2026-11-15T22:59:59Z"))), "2026-11-08T23:00:00.000Z");
  assert.equal(iso(weekStart(new Date("2026-11-15T23:00:00Z"))), "2026-11-15T23:00:00.000Z");
});

test("the week of the switch to summer time is one hour shorter", () => {
  // Clocks go forward on Sun 29 Mar 2026: week starts in winter time (UTC+1)
  // and ends in summer time (UTC+2).
  const { start, end } = weekRange(new Date("2026-03-25T12:00:00Z"));
  assert.equal(iso(start), "2026-03-22T23:00:00.000Z");
  assert.equal(iso(end), "2026-03-29T22:00:00.000Z");
  assert.equal(end.getTime() - start.getTime(), 167 * HOUR);
  // Sunday evening after the switch is still the same week.
  assert.equal(iso(weekStart(new Date("2026-03-29T21:30:00Z"))), "2026-03-22T23:00:00.000Z");
});

test("the week of the switch back to winter time is one hour longer", () => {
  // Clocks go back on Sun 25 Oct 2026.
  const { start, end } = weekRange(new Date("2026-10-21T12:00:00Z"));
  assert.equal(iso(start), "2026-10-18T22:00:00.000Z");
  assert.equal(iso(end), "2026-10-25T23:00:00.000Z");
  assert.equal(end.getTime() - start.getTime(), 169 * HOUR);
  assert.equal(iso(weekStart(new Date("2026-10-25T22:30:00Z"))), "2026-10-18T22:00:00.000Z");
});

test("clock changes in 2027 are handled the same way", () => {
  assert.equal(iso(weekRange(new Date("2027-03-24T12:00:00Z")).end), "2027-03-28T22:00:00.000Z");
  assert.equal(iso(weekRange(new Date("2027-10-27T12:00:00Z")).start), "2027-10-24T22:00:00.000Z");
  assert.equal(iso(weekRange(new Date("2027-10-27T12:00:00Z")).end), "2027-10-31T23:00:00.000Z");
});

test("a kickoff is classed as last week, this week or next week", () => {
  const now = new Date("2026-11-18T12:00:00Z"); // Wednesday
  assert.equal(weekOf("2026-11-15T22:59:00Z", now), "past"); // Sun 23:59 local
  assert.equal(weekOf("2026-11-15T23:00:00Z", now), "current"); // Mon 00:00 local
  assert.equal(weekOf("2026-11-22T22:59:00Z", now), "current"); // Sun 23:59 local
  assert.equal(weekOf("2026-11-22T23:00:00Z", now), "future"); // next Mon 00:00
});

// --- the same definition in the database ---------------------------------------------

test("the database's week_start() agrees with src/lib/week.ts", async () => {
  const moments = [
    "2026-11-15T22:59:59Z",
    "2026-11-15T23:00:00Z",
    "2026-03-29T00:30:00Z",
    "2026-03-29T21:30:00Z",
    "2026-03-29T22:00:00Z",
    "2026-10-25T00:30:00Z",
    "2026-10-25T22:59:59Z",
    "2026-10-25T23:00:00Z",
    "2027-03-28T12:00:00Z",
    "2027-10-31T12:00:00Z",
  ];
  for (const moment of moments) {
    const response = await supabaseRest("rpc/week_start", {
      method: "POST",
      body: JSON.stringify({ p_at: moment }),
    });
    assert.equal(response.status, 200);
    const fromDatabase = new Date(await response.json());
    assert.equal(iso(fromDatabase), iso(weekStart(new Date(moment))), `week of ${moment}`);
  }
});

// --- status changes (rotate_matches) -------------------------------------------------------

// What status a match should have at `now`, by the database's own rules
// (match_status_at() — the function rotate_matches() applies to every match).
async function statusAt(status: string, kickoff: string, now: string): Promise<string> {
  const response = await supabaseRest("rpc/match_status_at", {
    method: "POST",
    body: JSON.stringify({ p_status: status, p_kickoff: kickoff, p_now: now }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

// Wednesday 18 Nov 2026, 13:00 Bratislava. This week starts Mon 16 Nov
// (15 Nov 23:00 UTC), last week started Mon 9 Nov (8 Nov 23:00 UTC).
const NOW = "2026-11-18T12:00:00Z";
const minutesBefore = (minutes: number) => new Date(Date.parse(NOW) - minutes * 60_000).toISOString();

test("a match goes live at kickoff", async () => {
  assert.equal(await statusAt("upcoming", minutesBefore(-60), NOW), "upcoming");
  assert.equal(await statusAt("upcoming", minutesBefore(0), NOW), "live");
  assert.equal(await statusAt("upcoming", minutesBefore(60), NOW), "live");
});

test("a match finishes 2 h 30 min after kickoff (voting closes)", async () => {
  assert.equal(await statusAt("live", minutesBefore(149), NOW), "live");
  assert.equal(await statusAt("live", minutesBefore(150), NOW), "finished");
  // Never went live (e.g. the job didn't run): straight to finished.
  assert.equal(await statusAt("upcoming", minutesBefore(3 * 24 * 60), NOW), "finished");
});

test("a match an admin finished early stays finished", async () => {
  assert.equal(await statusAt("finished", minutesBefore(10), NOW), "finished");
});

test("a match is archived only once its week is two weeks old", async () => {
  // Kickoff in last week: still reachable by its link.
  assert.equal(await statusAt("finished", "2026-11-08T23:00:00Z", NOW), "finished");
  // Kickoff one second before last week started: archived.
  assert.equal(await statusAt("finished", "2026-11-08T22:59:59Z", NOW), "archived");
  // An archived match never comes back.
  assert.equal(await statusAt("archived", minutesBefore(-60), NOW), "archived");
});

test("archiving respects a clock change between the two weeks", async () => {
  // Wed 28 Oct 2026: this week started Mon 26 Oct 00:00 winter time
  // (25 Oct 23:00 UTC), last week Mon 19 Oct 00:00 summer time (18 Oct 22:00
  // UTC). "Minus 7 days" would wrongly give 18 Oct 23:00 UTC.
  const now = "2026-10-28T12:00:00Z";
  assert.equal(await statusAt("finished", "2026-10-18T22:30:00Z", now), "finished");
  assert.equal(await statusAt("finished", "2026-10-18T21:59:59Z", now), "archived");
});

test("rotate_matches() can't be run by the public", async () => {
  const response = await supabaseRest("rpc/rotate_matches", { method: "POST", body: "{}" });
  assert.ok(!response.ok, `expected a refusal, got ${response.status}`);
});

test("the old test match has been archived by the scheduled job", async () => {
  // The hidden "Internal tests" match from 2020 is far older than last
  // week, so rotate_matches() archives it and RLS hides it from visitors.
  const rows = await (await supabaseRest(`matches?id=eq.${FIXTURE.finishedMatchId}&select=id`)).json();
  assert.deepEqual(rows, []);
  // The test match in 2099 is untouched.
  const open = await (await supabaseRest(`matches?id=eq.${FIXTURE.openMatchId}&select=status`)).json();
  assert.equal(open[0].status, "upcoming");
});
