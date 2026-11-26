-- FanMap database schema — canonical reference copy.
--
-- This is NOT run automatically against anything. The live Supabase
-- project's schema was built incrementally (via the Supabase MCP
-- connection, directly against the database — see docs/decisions-log.md
-- 2026-10-19 for why: the project already had a partial schema and real
-- seed data before this file existed, so it was altered in place rather
-- than dropped and recreated). This file is what you'd run against a
-- *fresh* Supabase project to reproduce the same schema from scratch — a
-- new environment, CI, or a disaster-recovery rebuild. If you add a
-- supabase/migrations/ folder later, this is the natural starting point.
--
-- Keep this file in sync by hand when the live schema changes (there is no
-- automation enforcing that yet — note it in docs/decisions-log.md too
-- when you do).

-- LEAGUES ---------------------------------------------------------------
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sport text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- TEAMS -------------------------------------------------------------------
-- No official club logos by default (logo_url stays null) — see
-- docs/idea.md "trademark caution": real crests need a license we don't
-- have. The UI falls back to name + colors (src/components/TeamBadge.tsx).
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null,
  short_name text not null,
  primary_color text not null,
  secondary_color text not null,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index teams_league_id_idx on public.teams(league_id);

-- MATCHES -------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  kickoff_at timestamptz not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'live', 'finished', 'archived')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  constraint matches_distinct_teams check (home_team_id <> away_team_id)
);
create index matches_league_id_idx on public.matches(league_id);
create index matches_home_team_id_idx on public.matches(home_team_id);
create index matches_away_team_id_idx on public.matches(away_team_id);
create index matches_status_idx on public.matches(status);

-- VOTES -------------------------------------------------------------------
-- region_code: nullable, reserved for Phase 2/3 regional granularity (US
-- counties / EU NUTS) — see docs/idea.md. Unused at MVP scope so that tier
-- doesn't require a schema change later.
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  country_code text not null check (char_length(country_code) = 2),
  region_code text,
  voter_hash text not null,
  created_at timestamptz not null default now(),
  -- One vote per match per device/voter (see docs/idea.md vote-integrity rules).
  constraint votes_one_per_match_per_voter unique (match_id, voter_hash)
);
create index votes_match_id_idx on public.votes(match_id);
create index votes_team_id_idx on public.votes(team_id);

-- FEEDBACK (optional, per dev-prompt-chatgpt.md) ---------------------------
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  email text,
  message text not null,
  created_at timestamptz not null default now()
);

-- SERVER SECRETS -------------------------------------------------------------
-- Fingerprints (SHA-256) of secrets only our own server knows — never the
-- secrets themselves. Invisible to the API: RLS on, no policies, no grants.
-- The 'vote' row must match FANMAP_VOTE_SECRET in the app's environment;
-- README "Hlasovanie a bezpecnost" explains how to set or rotate it.
create table public.server_secrets (
  name text primary key,
  secret_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.server_secrets enable row level security;
revoke all on table public.server_secrets from anon, authenticated;
-- insert into public.server_secrets (name, secret_hash)
-- values ('vote', encode(sha256(convert_to('<the secret>', 'UTF8')), 'hex'));

-- VOTE SUBMISSION FUNCTION ---------------------------------------------------
-- The ONLY way votes get written. SECURITY DEFINER so it can insert into
-- votes (which has zero RLS policies for anon/authenticated — see below).
-- Called via Supabase RPC with the public anon key from
-- src/app/api/votes/route.ts — the app never uses a service-role key.
--
-- Because it is reachable with the public key, it must not trust its
-- caller: p_server_secret proves the call comes from our own server, which
-- is where the voter's country (from the request's IP) and identity hash
-- are determined. Without it anyone could vote directly with an invented
-- country and identity.
create or replace function public.submit_vote(
  p_match_id uuid,
  p_team_id uuid,
  p_country_code text,
  p_voter_hash text,
  p_server_secret text
)
returns public.votes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_row public.votes;
begin
  if p_server_secret is null or not exists (
    select 1 from public.server_secrets
    where name = 'vote'
      and secret_hash = encode(sha256(convert_to(p_server_secret, 'UTF8')), 'hex')
  ) then
    raise exception 'votes are only accepted from the app server' using errcode = '42501';
  end if;

  select * into v_match from public.matches where id = p_match_id;

  if v_match.id is null then
    raise exception 'match not found' using errcode = '22023';
  end if;

  -- Voting is open only before and during a match. VC001 is our own code
  -- ("voting closed") so the API can tell this apart from invalid input
  -- and answer with a clear message (src/app/api/votes/route.ts).
  if v_match.status in ('finished', 'archived') then
    raise exception 'voting is closed for this match' using errcode = 'VC001';
  end if;

  if p_team_id <> v_match.home_team_id and p_team_id <> v_match.away_team_id then
    raise exception 'team is not part of this match' using errcode = '22023';
  end if;

  -- Relies on votes_one_per_match_per_voter to raise 23505
  -- (unique_violation) on a duplicate vote; the API route maps that to
  -- HTTP 409 (friendly message, never a crash).
  insert into public.votes (match_id, team_id, country_code, voter_hash)
  values (p_match_id, p_team_id, upper(p_country_code), p_voter_hash)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_vote(uuid, uuid, text, text, text) from public;
grant execute on function public.submit_vote(uuid, uuid, text, text, text) to anon, authenticated;

-- VOTE RATE LIMIT -------------------------------------------------------------
-- One row per vote attempt, kept for an hour, so /api/votes can limit how
-- many votes one IP address sends. The address is stored only as a
-- fingerprint (SHA-256 mixed with the server secret), never as a raw IP.
-- Invisible to the API: RLS on, no policies, no grants.
create table public.vote_attempts (
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);
create index vote_attempts_ip_time_idx on public.vote_attempts (ip_hash, attempted_at desc);
create index vote_attempts_time_idx on public.vote_attempts (attempted_at);
alter table public.vote_attempts enable row level security;
revoke all on table public.vote_attempts from anon, authenticated;

-- Called by src/app/api/votes/route.ts before every vote. Returns true and
-- records the attempt when the address is under the limit, false when it is
-- over: 20 attempts a minute, 300 an hour (reasoning in
-- docs/decisions-log.md, 2026-11-14). A separate function from
-- submit_vote() on purpose: a rejected vote rolls back its transaction, so
-- attempts counted inside submit_vote() would vanish exactly when they
-- matter (duplicates, invalid votes).
create or replace function public.register_vote_attempt(
  p_ip_hash text,
  p_server_secret text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_minute integer;
  v_last_hour integer;
begin
  if p_server_secret is null or not exists (
    select 1 from public.server_secrets
    where name = 'vote'
      and secret_hash = encode(sha256(convert_to(p_server_secret, 'UTF8')), 'hex')
  ) then
    raise exception 'vote attempts are only accepted from the app server' using errcode = '42501';
  end if;

  if p_ip_hash is null or length(p_ip_hash) < 16 then
    raise exception 'invalid address fingerprint' using errcode = '22023';
  end if;

  -- Housekeeping: nothing older than the longest window is needed.
  delete from public.vote_attempts where attempted_at < now() - interval '1 hour';

  select
    count(*) filter (where attempted_at > now() - interval '1 minute'),
    count(*)
  into v_last_minute, v_last_hour
  from public.vote_attempts
  where ip_hash = p_ip_hash
    and attempted_at > now() - interval '1 hour';

  if v_last_minute >= 20 or v_last_hour >= 300 then
    return false;
  end if;

  insert into public.vote_attempts (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

revoke all on function public.register_vote_attempt(text, text) from public;
grant execute on function public.register_vote_attempt(text, text) to anon, authenticated;

-- MONTHLY MAP BUDGET ----------------------------------------------------------
-- Mapbox bills every map start above 50,000 a month. The site counts its own
-- map starts here (one row per UTC calendar month) and, at the limit set in
-- src/lib/mapBudgetServer.ts (49,000, or MAP_LOAD_LIMIT in Vercel), stops
-- starting maps and pauses voting until the 1st of next month. Reasoning in
-- docs/decisions-log.md, 2026-11-26. Invisible to the API: RLS on, no
-- policies, no grants; only the two functions below touch it.
create table public.map_load_counter (
  period date primary key,
  loads integer not null default 0 check (loads >= 0)
);
alter table public.map_load_counter enable row level security;
revoke all on table public.map_load_counter from anon, authenticated;

-- Called by src/app/api/map-load/route.ts right before a map starts. Counts
-- the start and returns allowed = true while this month is under p_limit;
-- at the limit it counts nothing more and returns allowed = false. Only our
-- server may call it (same server secret as voting), so nobody can use up
-- the budget by calling the database directly.
create or replace function public.register_map_load(p_server_secret text, p_limit integer)
returns table (allowed boolean, used integer, resets_on date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := (date_trunc('month', now() at time zone 'UTC'))::date;
  v_used integer;
begin
  if p_server_secret is null or not exists (
    select 1 from public.server_secrets
    where name = 'vote'
      and secret_hash = encode(sha256(convert_to(p_server_secret, 'UTF8')), 'hex')
  ) then
    raise exception 'map loads are only accepted from the app server' using errcode = '42501';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'invalid limit' using errcode = '22023';
  end if;

  insert into public.map_load_counter (period, loads) values (v_period, 0)
  on conflict (period) do nothing;

  update public.map_load_counter c
     set loads = c.loads + 1
   where c.period = v_period and c.loads < p_limit
  returning c.loads into v_used;

  if found then
    return query select true, v_used, (v_period + interval '1 month')::date;
  else
    select c.loads into v_used from public.map_load_counter c where c.period = v_period;
    return query select false, v_used, (v_period + interval '1 month')::date;
  end if;
end;
$$;

revoke all on function public.register_map_load(text, integer) from public;
grant execute on function public.register_map_load(text, integer) to anon, authenticated;

-- Read-only: is this month's budget used up, and when does it reset? Used
-- by the banner and by /api/votes. Returns no count, so traffic stays
-- private even though the public may call it.
create or replace function public.get_map_budget(p_limit integer)
returns table (paused boolean, resets_on date)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(c.loads, 0) >= p_limit,
    ((date_trunc('month', now() at time zone 'UTC'))::date + interval '1 month')::date
  from (select 1) x
  left join public.map_load_counter c
    on c.period = (date_trunc('month', now() at time zone 'UTC'))::date;
$$;

revoke all on function public.get_map_budget(integer) from public;
grant execute on function public.get_map_budget(integer) to anon, authenticated;

-- MATCH WEEK AND AUTOMATIC STATUS CHANGES -----------------------------------
-- A match week runs from Monday 00:00 to the next Monday 00:00 in Bratislava
-- time — the same definition as src/lib/week.ts (tests/week.test.ts checks
-- that both agree, including around clock changes). Lists on the site show
-- only the current week; rotate_matches() below moves every match through
-- its life on its own, every 5 minutes, so nobody has to do it in /admin.

-- Monday 00:00 (Bratislava) of the week that contains p_at. date_trunc on
-- the local time, then back to an absolute moment, so summer time is right.
-- A pure calculation (reads no table), so the public may call it; the
-- automated tests use it to compare with src/lib/week.ts.
create or replace function public.week_start(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', p_at at time zone 'Europe/Bratislava') at time zone 'Europe/Bratislava';
$$;

-- The status a match should have at moment p_now. Only ever moves forward:
--   upcoming -> live      once kickoff has passed
--   upcoming/live -> finished   2 h 30 min after kickoff (voting closes)
--   any -> archived       kickoff before the start of LAST week, so a
--                         match of week N stays reachable by its link
--                         through week N+1, then disappears (RLS).
-- A match an admin finished early stays finished. Pure calculation like
-- week_start(), callable by the public so the tests can check every rule.
create or replace function public.match_status_at(p_status text, p_kickoff timestamptz, p_now timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_status = 'archived' then 'archived'
    -- Start of last week = week_start of a moment one day before this
    -- week's Monday (not "minus 7 days", which is off by an hour in the
    -- week of a clock change).
    when p_kickoff < public.week_start(public.week_start(p_now) - interval '1 day') then 'archived'
    when p_status in ('upcoming', 'live') and p_kickoff + interval '2 hours 30 minutes' <= p_now then 'finished'
    when p_status = 'upcoming' and p_kickoff <= p_now then 'live'
    else p_status
  end;
$$;

-- Applies match_status_at() to every match that needs a change. Idempotent
-- (a second run changes nothing) and never deletes anything. Returns how
-- many matches changed. Run by pg_cron every 5 minutes (below); the public
-- and signed-in users can't call it.
create or replace function public.rotate_matches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_changed integer;
begin
  update public.matches m
  set status = public.match_status_at(m.status, m.kickoff_at, v_now)
  where m.status <> public.match_status_at(m.status, m.kickoff_at, v_now);
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function public.week_start(timestamptz) from public;
grant execute on function public.week_start(timestamptz) to anon, authenticated;
revoke all on function public.match_status_at(text, timestamptz, timestamptz) from public;
grant execute on function public.match_status_at(text, timestamptz, timestamptz) to anon, authenticated;
revoke all on function public.rotate_matches() from public, anon, authenticated;

-- Every 5 minutes. cron.schedule() with a job name replaces an existing job
-- of the same name, so running this again is safe.
create extension if not exists pg_cron;
select cron.schedule('rotate-matches', '*/5 * * * *', 'select public.rotate_matches()');

-- ROW LEVEL SECURITY --------------------------------------------------------
-- Public (anon/authenticated) gets read-only access to active content, and
-- NO direct write access anywhere. Writes to leagues/teams/matches happen
-- only for admins (see ADMIN below — /admin in the app); votes are written
-- only through submit_vote() above. A public
-- INSERT policy on votes would let anyone bypass the one-vote-per-device
-- rule by calling the API directly with a fresh voter_hash.
alter table public.leagues enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.votes enable row level security;
alter table public.feedback enable row level security;

create policy "public can read active leagues"
  on public.leagues for select
  to anon, authenticated
  using (is_active = true);

create policy "public can read active teams"
  on public.teams for select
  to anon, authenticated
  using (is_active = true);

create policy "public can read non-archived matches"
  on public.matches for select
  to anon, authenticated
  using (status <> 'archived');

create policy "public can submit feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (true);

-- No policies at all on votes for anon/authenticated: direct reads and
-- writes are both denied. Reading aggregated results goes through the
-- match_results view below instead.

-- ADMIN ---------------------------------------------------------------------
-- Admins sign in with Supabase Auth (email + password) at /admin. Signing in
-- alone grants nothing: the user must also have a row in admin_users,
-- which is added by hand (SQL editor / dashboard) — there's no self-service
-- path. Grant admin to an existing Auth user with:
--   insert into public.admin_users (user_id)
--   select id from auth.users where email = 'you@example.com';
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- No policies and no table grants: invisible to the API entirely. Only
-- is_admin() (SECURITY DEFINER) reads it.
revoke all on table public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Admins read everything (incl. inactive/archived) and insert/update.
-- These are added on top of the public SELECT policies above (Postgres
-- ORs permissive policies). No DELETE policies on purpose: matches are
-- archived (status = 'archived'), leagues/teams are deactivated
-- (is_active = false) — a delete would cascade into votes.
create policy "admins can read all leagues" on public.leagues
  for select to authenticated using (public.is_admin());
create policy "admins can insert leagues" on public.leagues
  for insert to authenticated with check (public.is_admin());
create policy "admins can update leagues" on public.leagues
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins can read all teams" on public.teams
  for select to authenticated using (public.is_admin());
create policy "admins can insert teams" on public.teams
  for insert to authenticated with check (public.is_admin());
create policy "admins can update teams" on public.teams
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins can read all matches" on public.matches
  for select to authenticated using (public.is_admin());
create policy "admins can insert matches" on public.matches
  for insert to authenticated with check (public.is_admin());
create policy "admins can update matches" on public.matches
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins can read feedback" on public.feedback
  for select to authenticated using (public.is_admin());

-- AGGREGATED RESULTS VIEW ----------------------------------------------------
-- Exposes vote counts per match/team/country without exposing individual
-- vote rows or voter_hash. Deliberately SECURITY DEFINER (the default for
-- a view — no security_invoker = true here), so it can read the
-- locked-down votes table — the one sanctioned way the public reads vote
-- data. This trips the Supabase security linter's "Security Definer View"
-- ERROR; that's expected and intentional, not a bug to fix — see the
-- COMMENT ON VIEW below and docs/decisions-log.md 2026-10-19.
create or replace view public.match_results as
select
  match_id,
  team_id,
  country_code,
  count(*) as vote_count
from public.votes
group by match_id, team_id, country_code;

grant select on public.match_results to anon, authenticated;

comment on view public.match_results is
  'Intentionally SECURITY DEFINER (not security_invoker): aggregates votes '
  '(counts only, no voter_hash, no individual rows) so the public app can '
  'read match results while the votes table itself has zero RLS policies '
  'and is fully locked to anon/authenticated. Do not "fix" the security '
  'linter ERROR on this view by adding security_invoker=true - that would '
  'make it inherit votes'' lockdown and break the public map. See '
  'docs/decisions-log.md 2026-10-19 and dev-prompt-chatgpt.md DATABASE SECURITY.';
