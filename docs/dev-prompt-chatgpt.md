# FanMap – ChatGPT dev/build prompt (needitovaný zdroj, plné znenie)

_Toto je vstupný materiál, NIE finálne rozhodnutie — pozri tech-stack.md pre aktuálne odporúčania a rozdiely oproti tomuto promptu (zhrnuté v decisions-log.md)._

---

You are a senior full-stack engineer and product-focused technical architect.

We are building a production-quality MVP called:

GLOBAL FAN MAP

Before writing code, carefully understand the product requirements and architecture.

IMPORTANT DEVELOPMENT PRINCIPLE:

The previous prototype built with an AI app builder became unstable because repeated changes caused:
- accidental vote submissions
- event propagation bugs
- unnecessary component remounting
- flickering when switching matches
- broken React hooks/imports
- duplicated voting UI

This project must be built with a clean architecture from the beginning.

Do not implement large changes blindly. Do not introduce unnecessary abstractions. Do not rewrite unrelated components when fixing a feature.

Prioritize: 1. correctness 2. stable state management 3. clean component boundaries 4. predictable event handling 5. performance 6. maintainability 7. visual quality

## PRODUCT
Global Fan Map is an interactive sports fan visualization platform. Users open a sports match and see a world map showing which countries support each of the two competing teams (e.g. Liverpool vs Manchester City). Each country can show support for one team based on user voting. Users can explore maps WITHOUT voting; voting is optional. If users vote: only one team per match, duplicate voting must be prevented, voting must never happen accidentally. NOT a betting/prediction product — a fan support visualization platform. Primary message: "See which countries support your club."

## TECH STACK
Frontend: React, TypeScript, Vite, Tailwind CSS. Backend: Supabase, PostgreSQL, Supabase Auth, Supabase Edge Functions where appropriate. Map: Mapbox GL JS. Deployment: Vercel compatible. Repository: GitHub-ready. Clean project structure; create README.md, .env.example, clear setup instructions.

## MAPBOX
Use Mapbox GL JS. Public token loaded from VITE_MAPBOX_TOKEN, never hardcoded. Map must: initialize only once, reuse the same instance, update layers/data on match change, not remount, avoid flickering. Dark premium visual style, recommended `mapbox://styles/mapbox/dark-v11`. Visual direction: premium dark background, subtle borders, focus on country visualization, vivid but elegant team colors, smooth transitions, responsive.

## CORE DATA MODEL
LEAGUES: id, name, slug, sport, is_active, created_at.
TEAMS: id, league_id, name, short_name, primary_color, secondary_color, logo_url, is_active, created_at.
MATCHES: id, league_id, home_team_id, away_team_id, kickoff_at, status (upcoming/live/finished/archived), is_featured, created_at.
VOTES: id, match_id, team_id, country_code, voter_hash, created_at. A voter can vote only once per match — enforce with a unique constraint on match_id + voter_hash.
Optional FEEDBACK table: id, type, email, message, created_at.

## LEAGUES
Football: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UEFA Champions League. US sports: NFL, NBA, MLB, NHL, MLS. Schema designed so more leagues/sports can be added later.

## TEAM DATA
Real name, short name, logo URL, primary/secondary color. Always attempt to show the logo; if it fails/missing, show a clean fallback badge with initials — must not break layout.

## APPLICATION STRUCTURE
App → Navigation (league navigation) → Main experience: MatchSidebar (MatchList → MatchRow), MapArea (MatchHeader, GlobalMap, CountryTooltip), ShareSection, Footer. Admin area routes separate from public UI.

## HOME PAGE
Premium landing page. Hero: Global Fan Map branding, headline "See which countries support your club.", short explanation, CTA "Explore Matches", large visual world map. Homepage demo match: Liverpool vs Manchester City, two contrasting premium (not neon) colors — Liverpool red family, Man City sky blue family. For the homepage demo map only, try to avoid same color on large neighboring countries (USA/Canada, Brazil/Argentina, China/Russia, India/China differ where possible) — does not affect real match vote maps.

## MAIN MATCH EXPERIENCE
Desktop: league navigation, collapsible match sidebar, large map area, match header above map, share section below. When sidebar hidden, map expands into the space (not just shifts). Mobile: compact nav, horizontally scrollable league tabs, match list via drawer/bottom sheet, large usable map, touch-friendly controls.

## MATCH SIDEBAR
Each row compact and premium: status, kickoff date/time, home logo+name, away name+logo, always-visible percentage distribution bar (neutral 50/50 or empty state at 0 votes), "View Map" button. Do not show supporter count inside every sidebar row.

## CRITICAL INTERACTION RULES
Strict separation between MATCH SELECTION and VOTING. Clicking the match row or "View Map" button must ONLY select the match/update selectedMatchId/update map/update header — must NEVER submit a vote. Voting must happen ONLY on explicit click/tap of home/away team name or logo. Recommended structure: MatchRow contains HomeTeamVoteButton, AwayTeamVoteButton, ViewMapButton as clearly separated actions — no vote handler on the parent container, ViewMapButton not nested inside a vote button, no overlapping click areas, semantic buttons, correct touch/mouse handling, prevent accidental event propagation. Acceptance test: open an unvoted match, click View Map → match changes, map updates, NO vote submitted, NO team selected.

## VOTING
User explicitly selects a team → submit vote → backend validates → UI updates → map updates → team highlighted. One vote per match; user may vote in multiple different matches. Vote state must persist and be restored correctly when switching away and back to a match (not just temporary component state) — previous vote and highlighted state must remain visible.

## DUPLICATE VOTES
Expected business behavior. Backend returns HTTP 409 on duplicate (e.g. "You have already voted on this match.") — must NOT crash the app, show a runtime error screen, or trigger an error boundary. Instead show a subtle toast: "Your vote for this match is already recorded."

## ANTI-SPAM
Lightweight protection for MVP. voter_hash generated server-side from IP-related info where safely available + user agent + persistent random cookie seed. Do not store raw unnecessary personal data. One vote per match per voter_hash + basic rate limiting. No CAPTCHA for MVP — keep friction low. Voting backend implemented safely, no privileged DB keys exposed in frontend.

## MAP DATA
Visualize country-level vote results. Per country: support distribution between the two teams; color = majority team's color, or neutral if no votes. Hover/click tooltip: country name, Team A %, Team B %, total votes. Map usable before voting.

## MAP MATCH SWITCHING
Must be stable. Clicking View Map should ONLY update selectedMatchId/selected match data/map source-layer data/match header — must NOT remount the entire page, match list, or recreate the Mapbox instance; avoid flickering. Stable React keys; do not use selectedMatchId as a key that forces remounts. Initialize Mapbox once, update GeoJSON source data on match change.

## MATCH HEADER ABOVE MAP
Premium header, layout LEFT TEAM | CENTER DISTRIBUTION | RIGHT TEAM (logo, name, vote count, percentage bar, vote count, name, logo). Requirements: supporter counts up to 7 digits, counts stay on the same row as team names, percentage bar stays centered relative to the map, team name length must not shift the center bar, header width always matches map container, header resizes with map on sidebar open/close, bar slightly thicker, bar may shorten to fit large counts, visually balanced. Use CSS Grid (e.g. `1fr auto 1fr`); team text length must never push the center bar off-center.

## VOTE COUNT ANIMATION
If lightweight: subtle smooth numeric transition on vote count changes; percentage bar may animate on result change. Animations short, subtle, performant — not heavy/continuous.

## SELECTED TEAM VISUAL STATE
After a successful vote: team button clearly shows selected/voted/persistent state (subtle green accent, checkmark, gentle border or glow) — not excessive animation. State must remain when returning to the match later.

## SHARING
Each match has a shareable direct URL `/match/{matchId}`; opening it loads the app, selects the correct match, map, and results. Share section below map: X/Twitter, Facebook, Reddit, Copy Link, native Web Share API on supported mobile. Share actions share the direct match URL. Compact, premium sharing UI.

## TRENDING MATCH
Subtle "Trending" badge on the match with the highest vote count — do not overuse badges.

## THEME
Dark mode, light mode, system default; persist choice in localStorage; map style adapts.

## PUBLIC MATCH VISIBILITY
Public users see upcoming/live/recently finished matches. Archived matches are admin-only, not public.

## ADMIN
Basic protected admin area at `/admin`, using Supabase Auth. Capabilities: add/edit league, add/edit team, add/edit match (select teams, kickoff time, status, featured), archive match. Do not overbuild — simple, functional, secure.

## CONTACT
Footer links: About, Privacy, Disclaimer, Contact, Report Issue. Configurable email addresses (CONTACT_EMAIL, SUPPORT_EMAIL, not hardcoded deep in components). Mailto links for now.

## PERFORMANCE
Mapbox initialized once, stable component tree and React keys, avoid unnecessary re-renders and full page re-render on match select, memoize only where it provides real value, lazy-load heavy components where reasonable, good mobile performance. No premature optimization complexity.

## DATABASE SECURITY
Supabase Row Level Security. Public users can read active leagues/teams/public matches/aggregated public vote data where appropriate; cannot modify teams/matches or directly manipulate arbitrary vote records. Voting via a controlled backend path (e.g. Supabase Edge Function). Admin access requires authenticated admin privileges.

## ENVIRONMENT VARIABLES
.env.example with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MAPBOX_TOKEN. No committed secrets; Mapbox public token supplied by the developer/user via env config; never hardcode production credentials.

## IMPLEMENTATION PROCESS
Do not build everything in one uncontrolled step — work in phases, wait for confirmation on major architectural decisions.
- Phase 1: inspect existing repo, propose architecture, propose DB schema, identify dependencies, create implementation plan.
- Phase 2: foundation — project structure, routing, Tailwind setup, Supabase client, Mapbox component shell, DB migration files.
- Phase 3: core data flow — leagues, teams, matches, selected match state, match sidebar, View Map action. Do NOT implement voting accidentally through match selection at this stage.
- Phase 4: voting backend — test first vote, duplicate vote, switching matches, returning to previous match.
- Phase 5: map country visualization.
- Phase 6: responsive UI.
- Phase 7: sharing and admin.
- Phase 8: final checks — TypeScript, build, lint, runtime behavior, mobile interaction, accidental voting, match switching flicker.

## MANDATORY ACCEPTANCE TESTS
1. Open match without voting → map loads successfully.
2. Click View Map → match changes, NO vote submitted.
3. Click a team → one vote submitted.
4. Vote again → friendly toast, no crash.
5. Vote Match A → switch to Match B → return to Match A → original vote still visible.
6. Switch matches repeatedly → no visible flickering.
7. Mobile: tap View Map → no accidental vote.
8. Refresh page → selected match and vote data load correctly.
9. Open direct match URL → correct match opens.
10. Run production build → no TypeScript errors.

## FINAL DELIVERABLE
Clean source code, database migrations, Supabase setup documentation, .env.example, README, working production build, clear architecture, GitHub-ready project. Prioritize reliability over excessive features; never sacrifice core interaction stability for visual complexity.
