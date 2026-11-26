// Tests docs/migrations/2026-11-26-privacy-retention.sql on an in-memory
// Postgres (PGlite), with the real definitions of votes, vote_attempts,
// feedback and match_results from docs/schema.sql. pg_cron isn't available
// here, so cron.schedule() is a stub that records the jobs, and the two
// scheduled DELETE statements are run by hand.
//
// Not part of `npm test` (it needs PGlite, which the app doesn't use). Run:
//   mkdir /tmp/sqltest && cd /tmp/sqltest && npm i @electric-sql/pglite@0.2.17
//   cp <repo>/docs/migrations/2026-11-26-privacy-retention.test.mjs test.mjs
//   node test.mjs <repo>/docs/migrations/2026-11-26-privacy-retention.sql
// Every line should start with PASS.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) process.exitCode = 1; };

await db.exec(`
  create role anon; create role authenticated;
  create schema cron;
  create table cron.job (jobname text primary key, schedule text, command text);
  create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
    insert into cron.job values (p_name, p_schedule, p_command)
    on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command;
    select 1::bigint;
  $$;
  create table public.teams (id uuid primary key default gen_random_uuid());
  create table public.matches (
    id uuid primary key default gen_random_uuid(),
    home_team_id uuid not null references public.teams(id),
    away_team_id uuid not null references public.teams(id),
    kickoff_at timestamptz not null,
    status text not null
  );
  -- From docs/schema.sql:
  create table public.votes (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references public.matches(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete cascade,
    country_code text not null check (char_length(country_code) = 2),
    region_code text,
    voter_hash text not null,
    created_at timestamptz not null default now(),
    constraint votes_one_per_match_per_voter unique (match_id, voter_hash)
  );
  create table public.feedback (id uuid primary key default gen_random_uuid(), type text not null, email text, message text not null, created_at timestamptz not null default now());
  create table public.vote_attempts (ip_hash text not null, attempted_at timestamptz not null default now());
  create view public.match_results as
    select match_id, team_id, country_code, count(*) as vote_count from public.votes group by match_id, team_id, country_code;
`);

// Teams and matches: closed long ago (finished, archived), closed recently,
// and one far in the future that already has early votes.
const [h, a] = (await q(`insert into teams (id) values (default), (default) returning id`)).map((r) => r.id);
const match = async (status, kickoffDays) =>
  (await q(`insert into matches (home_team_id, away_team_id, kickoff_at, status) values ($1, $2, now() + ($3 || ' days')::interval, $4) returning id`, [h, a, kickoffDays, status]))[0].id;
const mFinishedOld = await match("finished", -40);
const mArchivedOld = await match("archived", -60);
const mFinishedNew = await match("finished", -3);
const mUpcomingFar = await match("upcoming", 30); // votes cast 40 days before kickoff

let n = 0;
const vote = (m, team, cc, daysAgo) =>
  q(`insert into votes (match_id, team_id, country_code, voter_hash, created_at) values ($1, $2, $3, $4, now() - ($5 || ' days')::interval)`,
    [m, team, cc, `hash-${n++}`, daysAgo]);
for (let i = 0; i < 50; i++) await vote(mFinishedOld, i % 3 ? h : a, ["SK", "DE", "GB"][i % 3], 41);
for (let i = 0; i < 30; i++) await vote(mArchivedOld, i % 2 ? h : a, ["FR", "SK"][i % 2], 61);
for (let i = 0; i < 20; i++) await vote(mFinishedNew, h, "CZ", 4);
for (let i = 0; i < 10; i++) await vote(mUpcomingFar, a, "BR", 40);
// The same device voted in two old matches: both rows share its hash pattern
// per match; after anonymizing they must no longer be linkable.
await q(`insert into votes (match_id, team_id, country_code, voter_hash, created_at) values ($1, $2, 'AT', 'same-device', now() - interval '45 days'), ($3, $2, 'AT', 'same-device', now() - interval '45 days')`, [mFinishedOld, h, mArchivedOld]);

const snapshot = async () => ({
  results: JSON.stringify(await q(`select * from match_results order by match_id, team_id, country_code`)),
  totals: JSON.stringify(await q(`select match_id, count(*)::int n from votes group by 1 order by 1`)),
  rows: JSON.stringify(await q(`select id, match_id, team_id, country_code, region_code, created_at from votes order by id`)),
});
const before = await snapshot();

await db.exec(readFileSync(process.argv[2], "utf8"));
const changed = (await q(`select public.anonymize_old_votes() as n`))[0].n;
const after = await snapshot();

ok(changed === 82, `anonymized ${changed} votes (expected 82: 51 + 31 old votes of closed matches)`);
ok(before.results === after.results, "match_results identical before and after");
ok(before.totals === after.totals, "vote totals per match identical");
ok(before.rows === after.rows, "every other column of every vote unchanged");
const left = await q(`select m.status, count(*)::int n, count(*) filter (where voter_hash like 'anon:%')::int anon
  from votes v join matches m on m.id = v.match_id group by 1 order by 1`);
console.log("       by match status:", JSON.stringify(left));
ok(left.find((r) => r.status === "upcoming").anon === 0, "early votes for a match not yet played keep their identifier");
ok(left.find((r) => r.status === "finished").n - left.find((r) => r.status === "finished").anon === 20, "recent votes (4 days) keep their identifier");
ok((await q(`select count(*)::int n from votes where voter_hash = 'same-device'`))[0].n === 0, "the same device's old votes can no longer be linked");
ok((await q(`select count(*)::int n from (select match_id, voter_hash from votes group by 1, 2 having count(*) > 1) d`))[0].n === 0, "unique (match_id, voter_hash) still holds");

const again = (await q(`select public.anonymize_old_votes() as n`))[0].n;
ok(again === 0, `second run changes nothing (${again})`);

// Permissions: nobody but the owner/cron may run it.
const grants = await q(`select grantee from information_schema.routine_privileges where routine_name = 'anonymize_old_votes'`);
ok(!grants.some((g) => ["PUBLIC", "anon", "authenticated"].includes(g.grantee)), `no execute for public/anon/authenticated (grantees: ${grants.map((g) => g.grantee).join(", ")})`);

// Scheduled jobs and their statements.
const jobs = await q(`select jobname, schedule, command from cron.job order by 1`);
console.log("       jobs:", JSON.stringify(jobs));
ok(jobs.length === 3, "three jobs scheduled");
await q(`insert into vote_attempts values ('a', now() - interval '2 hours'), ('b', now() - interval '61 minutes'), ('c', now() - interval '5 minutes')`);
await q(`insert into feedback (type, email, message, created_at) values ('x', 'old@example.com', 'old', now() - interval '200 days'), ('x', null, 'new', now() - interval '10 days')`);
for (const j of jobs.filter((j) => j.jobname !== "anonymize-old-votes")) await db.exec(j.command);
ok((await q(`select string_agg(ip_hash, ',') s from vote_attempts`))[0].s === "c", "purge-vote-attempts keeps only the last hour");
ok((await q(`select string_agg(message, ',') s from feedback`))[0].s === "new", "purge-old-feedback deletes messages older than 180 days");

// Running the whole migration again is safe.
await db.exec(readFileSync(process.argv[2], "utf8"));
ok((await q(`select count(*)::int n from cron.job`))[0].n === 3, "running the migration twice still leaves three jobs");
