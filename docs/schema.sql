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

-- VOTE SUBMISSION FUNCTION ---------------------------------------------------
-- The ONLY way votes get written. SECURITY DEFINER so it can insert into
-- votes (which has zero RLS policies for anon/authenticated — see below)
-- while itself being narrowly scoped and auditable. Called via Supabase
-- RPC with the public anon key from src/app/api/votes/route.ts — the app
-- never uses a service-role key anywhere.
create or replace function public.submit_vote(
  p_match_id uuid,
  p_team_id uuid,
  p_country_code text,
  p_voter_hash text
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
  select * into v_match from public.matches where id = p_match_id;

  if v_match.id is null then
    raise exception 'match not found' using errcode = '22023';
  end if;

  if v_match.status = 'archived' then
    raise exception 'match is archived and no longer accepts votes' using errcode = '22023';
  end if;

  if p_team_id <> v_match.home_team_id and p_team_id <> v_match.away_team_id then
    raise exception 'team is not part of this match' using errcode = '22023';
  end if;

  -- Relies on votes_one_per_match_per_voter to raise 23505
  -- (unique_violation) on a duplicate vote; the API route maps that to
  -- HTTP 409 (dev-prompt-chatgpt.md "DUPLICATE VOTES": friendly toast,
  -- never a crash).
  insert into public.votes (match_id, team_id, country_code, voter_hash)
  values (p_match_id, p_team_id, upper(p_country_code), p_voter_hash)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_vote(uuid, uuid, text, text) from public;
grant execute on function public.submit_vote(uuid, uuid, text, text) to anon, authenticated;

-- ROW LEVEL SECURITY --------------------------------------------------------
-- Public (anon/authenticated) gets read-only access to active content, and
-- NO direct write access anywhere. Writes to leagues/teams/matches happen
-- via an authenticated admin path (not built yet — dev-prompt-chatgpt.md
-- Phase 7); votes are written only through submit_vote() above. A public
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
