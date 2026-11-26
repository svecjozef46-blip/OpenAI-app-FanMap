-- PRIVACY: HOW LONG PERSONAL DATA IS KEPT (retention)
-- 2026-11-26. Reasoning in docs/privacy.md and docs/decisions-log.md.
--
-- NOT YET APPLIED to the production database. The owner applies it after
-- review: Supabase dashboard -> SQL Editor -> paste this whole file -> Run
-- (it is safe to run more than once). Afterwards check:
--   select jobname, schedule, command from cron.job order by jobname;
-- which should list anonymize-old-votes, purge-old-feedback,
-- purge-vote-attempts and rotate-matches.
--
-- Three rules:
--   1. votes.voter_hash   replaced by a random value 35 days after the vote,
--                         once the match is closed (finished or archived).
--   2. vote_attempts      address fingerprints deleted after 1 hour, also
--                         when nobody votes (until now only the next vote
--                         cleaned up).
--   3. feedback           deleted after 180 days.
-- Nothing else changes: the votes themselves (match, team, country, time)
-- stay, so every result and total is exactly the same before and after.

-- 1. VOTER IDENTIFIER --------------------------------------------------------
-- voter_hash = sha256(random device key : IP address : browser) (computed in
-- src/app/api/votes/route.ts). It exists to stop the same device voting
-- twice in one match (unique (match_id, voter_hash)). Once voting on a match
-- has closed it has no purpose left, so after 35 days it is replaced by a
-- random value. 35 days: a match closes at most a few days after its week
-- (rotate_matches()), which leaves a month for investigating abuse (e.g. a
-- burst of votes from one network) before the link between votes from the
-- same device is gone.
--
-- Safety: only votes of CLOSED matches are touched. submit_vote() refuses
-- votes for finished/archived matches, so the same device can't vote again
-- in a match whose identifier was replaced. A vote cast long before kickoff
-- (a match added weeks ahead) keeps its identifier until the match closes.
-- If an admin ever sets a closed match back to upcoming/live in /admin,
-- devices whose identifier was replaced could vote in it again.
--
-- Replaced values start with "anon:" so they are never picked up again and
-- are easy to count. Each is a fresh random UUID, so
-- votes_one_per_match_per_voter (unique (match_id, voter_hash)) still holds.
create or replace function public.anonymize_old_votes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer;
begin
  update public.votes v
     set voter_hash = 'anon:' || gen_random_uuid()::text
    from public.matches m
   where m.id = v.match_id
     and m.status in ('finished', 'archived')
     and v.created_at < now() - interval '35 days'
     and v.voter_hash not like 'anon:%';
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

-- Only the scheduled job (and the owner in the SQL Editor) runs it.
revoke all on function public.anonymize_old_votes() from public, anon, authenticated;

-- Every night at 03:17 UTC. cron.schedule() with a job name replaces an
-- existing job of the same name, so running this file again is safe.
select cron.schedule('anonymize-old-votes', '17 3 * * *', 'select public.anonymize_old_votes()');

-- 2. ADDRESS FINGERPRINTS (rate limit) ----------------------------------------
-- register_vote_attempt() deletes rows older than an hour, but only when
-- someone votes or starts a map: with no traffic the last fingerprints stay
-- (3 such rows on 2026-11-26). Every 15 minutes, so nothing is kept longer
-- than 1 h 15 min.
select cron.schedule(
  'purge-vote-attempts',
  '*/15 * * * *',
  $$delete from public.vote_attempts where attempted_at < now() - interval '1 hour'$$
);

-- 3. FEEDBACK -------------------------------------------------------------------
-- The table can hold an e-mail address and free text. The app has no
-- feedback form today (the table is empty), but the public key may insert
-- into it (policy "public can submit feedback"). 180 days: long enough to
-- read and answer a message, short enough not to keep addresses for no
-- reason. Daily at 03:23 UTC.
select cron.schedule(
  'purge-old-feedback',
  '23 3 * * *',
  $$delete from public.feedback where created_at < now() - interval '180 days'$$
);
