# Automated tests

Run everything with:

```
npm run dev      # in one window — the voting tests call the running app
npm test         # in another
```

Uses Node's built-in test runner (Node 24 runs the TypeScript files directly), so there is no test framework to install.

| File | What it checks | Needs the app running? |
|---|---|---|
| `voting.test.ts` | The voting flow through `/api/votes`: a first vote is accepted, a duplicate is rejected, a finished or archived match is rejected, wrong team and malformed requests are rejected, a visitor's vote without a valid Turnstile token is rejected. | Yes |
| `security.test.ts` | Database security, by calling Supabase directly with the public key like any stranger could: no reading, inserting, changing or deleting votes; no editing matches, teams or leagues; `submit_vote()` and the rate-limit function cannot be called directly without the server secret; one address gets 20 vote attempts a minute. | No |
| `week.test.ts` | The match week (Monday to Sunday, Bratislava time): boundaries, the weeks of the clock changes, that the database's `week_start()` agrees with `src/lib/week.ts`, every automatic status change (`match_status_at()`), that the public can't run `rotate_matches()`, and that the old test match has been archived. | No |
| `colors.test.ts` | Team colors stay distinguishable for color-blind fans, on tricky pairs and on every match currently in the database, in light and dark mode. | No |

## What the tests touch

They use the Supabase project from `.env.local` with the **public anon key**. They also read `FANMAP_VOTE_SECRET` from `.env.local`: the voting tests send it to the app to identify themselves (they can't solve a Turnstile challenge and would hit the rate limit), and the rate-limit test needs it to call the rate-limit function.

The voting tests write real votes, but only to a hidden fixture: the league **"Internal tests"** (`is_active = false`, so the site never shows it or its matches) with two teams and two matches — one open (kickoff in 2099) and one from 2020. The 2020 match is archived automatically by `rotate_matches()` (it is far older than last week); the voting test accepts that, since voting is closed either way. Their fixed ids are in `tests/helpers.ts`. Each run adds one vote to the open test match and about 20 rows to the rate-limit log (deleted automatically after an hour); both are harmless and can be ignored.

If the fixture is ever deleted, recreate it in the Supabase SQL editor:

```sql
insert into public.leagues (id, name, slug, sport, is_active) values
  ('00000000-0000-4000-a000-000000000001', 'Internal tests', 'internal-tests', 'football', false);
insert into public.teams (id, league_id, name, short_name, primary_color, secondary_color, is_active) values
  ('00000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000001', 'Test Home', 'TSH', '#C8102E', '#FFFFFF', false),
  ('00000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000001', 'Test Away', 'TSA', '#0057B8', '#FFFFFF', false);
insert into public.matches (id, league_id, home_team_id, away_team_id, kickoff_at, status) values
  ('00000000-0000-4000-a000-000000000021', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000012', '2099-01-01 12:00+00', 'upcoming'),
  ('00000000-0000-4000-a000-000000000022', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000012', '2020-01-01 12:00+00', 'finished');
```

In the admin, leave the "Internal tests" league and its matches alone.
