# FanMap (Global Fan Map)

Interaktívna platforma vizualizujúca globálnu fanúšikovskú podporu pre športové zápasy — svet-mapa krajín vyfarbená podľa toho, ktorý tím ľudia v danej krajine podporili.

Plná dokumentácia je v `docs/`:
- `docs/idea.md` — produktová idea, diferenciácia, riziká
- `docs/business-case.md` — cieľ, monetizácia, konkurencia
- `docs/tech-stack.md` — zvolený tech stack a zdôvodnenie
- `docs/decisions-log.md` — chronologický záznam rozhodnutí (čítaj pred väčšími zmenami — vysvetľuje PREČO, nie len čo)
- `docs/idea-original-chatgpt.md`, `docs/dev-prompt-chatgpt.md` — pôvodné needitované zdrojové materiály (referencia, nie aktuálna špecifikácia)

## Stack

Next.js (App Router, TypeScript, Tailwind) · Supabase (Postgres, generated REST API) · Mapbox GL JS · hosting na Vercel. Dôvody výberu sú v `docs/tech-stack.md`.

## Lokálny beh

```
npm install
cp .env.example .env.local   # doplň skutočné hodnoty, pozri nižšie
npm run dev
```

Appka beží na `http://localhost:3000`.

### Premenné prostredia (`.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — z Supabase projektu (Project Settings → API). Appka nikde nepoužíva service-role kľúč — pozri "Databáza" nižšie, prečo to nie je potrebné.
- `NEXT_PUBLIC_MAPBOX_TOKEN` — verejný (public) Mapbox token.
- `FANMAP_DEV_COUNTRY` — voliteľné, len pre lokálny vývoj. V produkcii (na Vercel) appka pozná krajinu hlasujúceho automaticky (hlavička `x-vercel-ip-country`), lokálne táto hlavička neexistuje, takže bez tejto premennej by `npm run dev` hlasovanie odmietal s `country_unknown`. Nastav na 2-písmenový kód krajiny, napr. `SK`.

## Databáza

Schéma (tabuľky `leagues`, `teams`, `matches`, `votes`, `feedback`, pohľad `match_results`, funkcia `submit_vote()`, RLS politiky) **nie je v tomto repe ako migračné súbory** — bola aplikovaná priamo cez Supabase MCP pripojenie počas vývoja. Kompletný, okomentovaný SQL záznam toho, čo je aktuálne live v databáze (vrátane dôvodov jednotlivých rozhodnutí), je v `docs/schema.sql` — ak budeš niekedy potrebovať schému znova vytvoriť (nový Supabase projekt, CI, atď.), tento súbor je zdroj pravdy; zváž jeho presunutie do `supabase/migrations/` ako prvý krok, ak pribudne tím alebo CI pipeline. Kontext a história rozhodnutí (prečo je to takto, nie len čo) je v `docs/decisions-log.md` pod dátumom 2026-10-19.

Kľúčové body dizajnu databázy (dôvody v `docs/schema.sql` a `docs/decisions-log.md`):
- Tabuľka `votes` nemá pre `anon`/`authenticated` role žiadne RLS politiky — priamy prístup (čítanie aj zápis) je úplne zablokovaný.
- Hlasovanie ide výhradne cez `public.submit_vote()` Postgres funkciu (`SECURITY DEFINER`), volanú z `src/app/api/votes/route.ts` cez Supabase RPC s verejným anon kľúčom. Preto appka nikde nepotrebuje service-role kľúč.
- Čítanie výsledkov hlasovania ide cez pohľad `public.match_results` (agregované počty hlasov podľa krajiny, žiadne surové riadky ani `voter_hash`) — jediný spôsob, akým appka číta dáta o hlasoch.
- Žiadne oficiálne logá klubov (`teams.logo_url` je zámerne `null`) — pozri `docs/idea.md` "trademark caution".

## Architektúra appky (stručne)

- `src/app/page.tsx`, `src/app/match/[matchId]/page.tsx` — stránky (server-side, naťahujú zápasy priamo z DB).
- `src/components/MatchExperience.tsx` — vlastník stavu `selectedMatchId`; drží pohromade sidebar, hlavičku, mapu a zdieľanie bez remountovania mapy pri prepnutí zápasu.
- `src/components/GlobalMap.tsx` — Mapbox GL inštancia sa vytvorí presne raz; prepnutie zápasu/nové hlasy menia len `feature-state`, nikdy nerecreatujú mapu (pozri komentáre v súbore — toto bolo explicitne krehké miesto v pôvodnom prototype, viď `docs/dev-prompt-chatgpt.md` "IMPORTANT DEVELOPMENT PRINCIPLE").
- `src/components/MatchRow.tsx`, `src/components/VoteButton.tsx` — výber zápasu (View Map) a hlasovanie (klik na tím) sú zámerne dva úplne oddelené, nijak neprepojené handlery — pozri `docs/dev-prompt-chatgpt.md` "CRITICAL INTERACTION RULES".
- `src/app/api/votes/route.ts` — jediné miesto, kde appka zisťuje IP adresu a krajinu žiadosti; samotnú validáciu a zápis robí `submit_vote()` v databáze.

## Čo (zámerne) ešte chýba

Pozri `docs/decisions-log.md` pre aktuálny stav. Zhruba: admin rozhranie na pridávanie zápasov (zatiaľ cez SQL/Supabase dashboard), league-tabs filtrovanie na hlavnej stránke, light/system theme (appka je zatiaľ len dark), skutočný realtime (teraz polling každých 15s).
