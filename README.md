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
- `NEXT_PUBLIC_MAP_ENGINE` — voliteľné. Prázdne alebo `mapbox` = mapa cez Mapbox (predvolené). `maplibre` = bezplatná verzia cez MapLibre bez tokenu a bez mesačného limitu spustení; dáta a písmo sú v `public/`. Číta sa pri builde, po zmene treba nasadiť znova. Podrobnosti v `docs/maplibre.md`.
- `FANMAP_VOTE_SECRET` — **povinné pre hlasovanie.** Dlhý náhodný reťazec, ktorým server dokazuje databáze, že hlas ide z našej appky. Pozri „Hlasovanie a bezpečnosť“ nižšie.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` a `TURNSTILE_SECRET_KEY` — kľúče Cloudflare Turnstile (overenie, že hlasuje človek). **Na produkcii povinné.** Lokálne môžu ostať prázdne, overenie je potom vypnuté. Pozri „Hlasovanie a bezpečnosť“ nižšie.
- `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_OPERATOR_ADDRESS`, `NEXT_PUBLIC_CONTACT_EMAIL` — kto stránku prevádzkuje a kontakt, zobrazené na stránke o ochrane súkromia (`/privacy`, `/privacy/sk`). Verejné; nastav všetky tri alebo žiadnu (nový riadok v adrese = `\n`). Kým chýbajú, stránka píše, že kontakt zverejníme pred spustením, a produkčný build na Verceli vypíše výrazné varovanie (`scripts/check-privacy-config.mjs`). **Pred spustením ich treba doplniť**; nikdy nevymýšľaj údaje. Pozri `docs/privacy.md`.
- `FANMAP_DEV_COUNTRY` — voliteľné, len pre lokálny vývoj. V produkcii (na Vercel) appka pozná krajinu hlasujúceho automaticky (hlavička `x-vercel-ip-country`), lokálne táto hlavička neexistuje, takže bez tejto premennej by `npm run dev` hlasovanie odmietal s `country_unknown`. Nastav na 2-písmenový kód krajiny, napr. `SK`.

## Databáza

Schéma (funkcie `rotate_matches()`, `match_status_at()`, `week_start()` a naplánovaná úloha pg_cron; tabuľky `leagues`, `teams`, `matches`, `votes`, `feedback`, `admin_users`, `server_secrets`, `vote_attempts`, pohľad `match_results`, funkcia `submit_vote()`, RLS politiky) **nie je v tomto repe ako migračné súbory** — bola aplikovaná priamo cez Supabase MCP pripojenie počas vývoja. Kompletný, okomentovaný SQL záznam toho, čo je aktuálne live v databáze (vrátane dôvodov jednotlivých rozhodnutí), je v `docs/schema.sql` — ak budeš niekedy potrebovať schému znova vytvoriť (nový Supabase projekt, CI, atď.), tento súbor je zdroj pravdy; zváž jeho presunutie do `supabase/migrations/` ako prvý krok, ak pribudne tím alebo CI pipeline. Kontext a história rozhodnutí (prečo je to takto, nie len čo) je v `docs/decisions-log.md` pod dátumom 2026-10-19.

Kľúčové body dizajnu databázy (dôvody v `docs/schema.sql` a `docs/decisions-log.md`):
- Tabuľka `votes` nemá pre `anon`/`authenticated` role žiadne RLS politiky — priamy prístup (čítanie aj zápis) je úplne zablokovaný.
- Hlasovanie ide výhradne cez `public.submit_vote()` Postgres funkciu (`SECURITY DEFINER`), volanú z `src/app/api/votes/route.ts` cez Supabase RPC s verejným anon kľúčom. Preto appka nikde nepotrebuje service-role kľúč.
- Čítanie výsledkov hlasovania ide cez pohľad `public.match_results` (agregované počty hlasov podľa krajiny, žiadne surové riadky ani `voter_hash`) — jediný spôsob, akým appka číta dáta o hlasoch.
- Žiadne oficiálne logá klubov (`teams.logo_url` je zámerne `null`) — pozri `docs/idea.md` "trademark caution".

## Týždenný cyklus zápasov

Web ukazuje vždy len zápasy **aktuálneho týždňa**: od pondelka 00:00 do nedele 24:00 v čase Europe/Bratislava (zmenu letného/zimného času rieši správne). Definícia týždňa je na jednom mieste, v `src/lib/week.ts`, a rovnaká je v databáze vo funkcii `week_start()`.

- **Zoznamy** (úvodná stránka, ligy, `/matches`) ukazujú len zápasy tohto týždňa. Zápasy budúceho týždňa môžeš v admine nahrať kedykoľvek vopred; na webe sa objavia až v pondelok. Keď tento týždeň nie je žiadny zápas, stránka napíše, kedy začína ďalšie kolo.
- **Priamy odkaz** `/match/[id]` na zápas z minulého týždňa funguje ďalej, ale zápas sa zobrazí samostatne (mapa a konečný výsledok, bez zoznamu ďalších zápasov) s tlačidlom na aktuálne zápasy.
- **Stavy zápasov sa menia samy** (databázová funkcia `rotate_matches()`, spúšťa ju pg_cron každých 5 minút):
  - `upcoming` → `live` vo chvíli výkopu,
  - → `finished` 2 h 30 min po výkope (hlasovanie sa uzavrie),
  - → `archived`, keď je výkop pred začiatkom minulého týždňa. Zápas z týždňa N je teda cez odkaz dostupný celý týždeň N+1, potom zmizne.
- Nič sa nemaže a stav ide len dopredu. Ak v admine ukončíš zápas skôr, ostane ukončený.
- **Odložený zápas:** v admine mu zmeň čas výkopu skôr, než pôvodný termín nastane, inak ho cron prepne na `live` a potom `finished`.
- Kontrola, či cron beží (Supabase → SQL Editor): `select * from cron.job_run_details order by start_time desc limit 5;`

## Hlasovanie a bezpečnosť

Hlas zapisuje databázová funkcia `submit_vote()`. Dá sa zavolať verejným kľúčom, preto neverí volajúcemu: hlas prijme len vtedy, keď dostane **tajný kľúč servera** (`FANMAP_VOTE_SECRET`). Ten pozná iba náš server (`src/app/api/votes/route.ts`), ktorý zároveň sám určuje krajinu hlasujúceho (podľa IP) a jeho identifikátor. Nikto zvonku tak nevie poslať hlas s vymyslenou krajinou alebo identitou.

- V databáze je uložený len odtlačok kľúča (SHA-256) v tabuľke `server_secrets`, nie kľúč samotný.
- Kľúč musí byť rovnaký v `.env.local` aj vo Verceli (Project → Settings → Environment Variables → `FANMAP_VOTE_SECRET`). **Bez neho hlasovanie na produkcii nefunguje** (appka vráti „Voting is temporarily unavailable“).
- Kľúč nikdy necommituj ani neposielaj. Ak unikne, vymeň ho:
  1. Vymysli nový dlhý náhodný reťazec a nastav ho v `.env.local` aj vo Verceli.
  2. V Supabase SQL Editore spusti (s novým kľúčom):
     ```sql
     update public.server_secrets
     set secret_hash = encode(sha256(convert_to('NOVY_KLUC', 'UTF8')), 'hex')
     where name = 'vote';
     ```

### Ochrana súkromia a uchovávanie údajov

Stránka `/privacy` (anglicky) a `/privacy/sk` (slovensky), odkaz v pätičke. Prehľad pre majiteľa (údaj – účel – základ – doba – kto ho vidí, otvorené otázky) je v `docs/privacy.md`. Uchovávanie zabezpečujú naplánované úlohy pg_cron z `docs/migrations/2026-11-26-privacy-retention.sql` (**zatiaľ neaplikované, aplikuje majiteľ**):

- `anonymize-old-votes` (denne 03:17 UTC) — 35 dní po hlase, keď je zápas uzavretý, nahradí `voter_hash` náhodnou hodnotou; výsledky sa nemenia.
- `purge-vote-attempts` (každých 15 minút) — maže odtlačky IP staršie ako hodinu aj vtedy, keď nikto nehlasuje.
- `purge-old-feedback` (denne 03:23 UTC) — maže spätnú väzbu staršiu ako 180 dní.

### Ochrana pred hromadným hlasovaním

Každý hlas prejde na serveri (`src/app/api/votes/route.ts`) dvoma kontrolami, skôr než sa zapíše:

1. **Limit podľa IP adresy:** najviac 20 pokusov o hlas za minútu a 300 za hodinu z jednej adresy. Počíta to databázová funkcia `register_vote_attempt()` nad tabuľkou `vote_attempts`. Adresa sa neukladá, len jej odtlačok, a záznamy staršie ako hodina sa mažú. Nad limit appka odpovie „Too many votes from your network right now“.
2. **Cloudflare Turnstile:** prehliadač si pred odoslaním hlasu vypýta od Cloudflare jednorazový token (`src/lib/turnstile.ts`) a server ho overí (`src/lib/turnstileServer.ts`). Bez platného tokenu sa hlas nezapíše. Token sa pripravuje vopred, hneď po otvorení stránky, aby hlasovanie nezdržiaval. Fanúšik zvyčajne nič nevidí; okienko s overením sa objaví dole na obrazovke, len keď Cloudflare chce kliknutie.

Nastavenie Turnstile:

- V Cloudflare (Turnstile → widget) musia byť v zozname domén `localhost` aj doména appky na Verceli.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` a `TURNSTILE_SECRET_KEY` musia byť v `.env.local` aj vo Verceli. **Bez `TURNSTILE_SECRET_KEY` hlasovanie na produkcii nefunguje.** Po zmene `NEXT_PUBLIC_…` kľúča treba appku vo Verceli znova nasadiť.
- Automatické testy sa preukazujú tajným kľúčom servera (hlavička `x-fanmap-test-secret`), preto ich Turnstile ani limit nezastaví.

## Testy

```
npm run dev   # v jednom okne (testy hlasovania volajú bežiacu appku)
npm test      # v druhom
```

Vstavaný testovací nástroj Node 24, bez ďalších závislostí. Pokrýva hlasovanie cez `/api/votes`, bezpečnosť databázy (RLS) volaním Supabase verejným kľúčom a rozlíšiteľnosť farieb tímov pri farbosleposti. Testy hlasujú len do skrytej ligy „Internal tests“, ktorú web nezobrazuje — v admine ju nechaj tak. Podrobnosti v `tests/README.md`.

## Ikony a inštalácia na plochu (PWA)

Appka sa dá pridať na plochu telefónu pod názvom „Fanzo“ (`src/app/manifest.ts`). Ikony kreslí `python scripts/generate-icons.py`; po zmene farieb v skripte ho stačí spustiť znova.

## Vzhľad: svetlý a tmavý režim

- Predvolene sa appka riadi nastavením zariadenia. Prepínač je v hornej lište, voľba Auto / Light / Dark v pätičke (`src/components/ThemeToggle.tsx`, logika v `src/lib/theme.ts`).
- Všetky farby verejnej časti sú **tokeny** v `src/app/globals.css` (`bg`, `surface`, `fg`, `muted`, `accent`…), každý má svetlú aj tmavú hodnotu na jednom mieste. V komponentoch sa používajú triedy ako `bg-surface`, `text-muted`, nie pevné farby.
- Mapa nemá vlastné pozadie (oceány sú priehľadné), takže splýva so stránkou v oboch režimoch. Farby pevniny a hraníc sú v `MAP_PALETTE` v `src/lib/mapSetup.ts`.
- Farby tímov na mape a v pruhoch sa prispôsobujú režimu (`src/lib/teamColors.ts`).
- Nadpisy používajú písmo Archivo (`font-display`), ostatný text Geist.
- Admin je vždy tmavý a tokeny nepoužíva.
- Odkazy na vlastné sociálne siete v pätičke sa zobrazia po vyplnení `NEXT_PUBLIC_INSTAGRAM_URL` a pod. v `.env.local` (pozri `.env.example`).

## Admin (`/admin`)

Jednoduché admin rozhranie na pridávanie a úpravu líg, tímov a zápasov a na archiváciu zápasov. Prihlásenie cez Supabase Auth (email + heslo).

**Ako si vytvoriť admin účet (raz):**
1. Supabase dashboard → Authentication → Users → **Add user** → zadaj email a heslo, zaškrtni *Auto Confirm User*.
2. Supabase dashboard → SQL Editor → spusti (s tvojím emailom):
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'tvoj@email.sk';
   ```
3. Otvor `/admin` a prihlás sa.

Odporúčanie: v Supabase → Authentication → Sign In / Providers vypni **Allow new users to sign up** — appka žiadnu registráciu nepotrebuje (aj keby si ju nechal zapnutú, nový účet bez riadku v `admin_users` nemá žiadne práva navyše).

Ako to funguje:
- `src/proxy.ts` — pri každej `/admin` požiadavke obnoví session cookie (štandardné `@supabase/ssr` nastavenie). Nie je to bezpečnostná kontrola.
- `src/lib/admin/auth.ts` → `requireAdmin()` — jediná brána: prihlásený používateľ **a** záznam v `admin_users`. Volá ju každá admin stránka aj každá Server Action (`src/app/admin/(panel)/actions.ts`).
- Databáza to vynucuje znova cez RLS (`is_admin()`), takže aj chyba v app kóde by nedovolila zápis ne-adminovi.
- Nič sa nemaže: zápas sa **archivuje** (skryje sa z verejnej stránky, zastaví hlasovanie, hlasy ostanú), liga/tím sa **deaktivuje**. Stavy `live`, `finished` aj archiváciu starých zápasov robí databáza sama (pozri „Týždenný cyklus zápasov“), ručne ich meniť netreba.
- Čas výkopu sa zadáva v **UTC** (dôvod v `src/lib/admin/form.ts`).

## Architektúra appky (stručne)

Stránky (`src/app/`, server-side, naťahujú dáta priamo z DB):
- `/` — landing page: mapa sveta cez celú obrazovku, ktorá sa strieda medzi zápasmi označenými v admine ako **Featured** (`HeroShowcase` + `HeroMap`), veľké zápasy a „ako to funguje“.
- `/league/[slug]`, `/match/[matchId]` (a `/matches` = všetky ligy, nie je v menu) — obrazovka zápasu (`MatchScreen` → `MatchExperience`). Zoznamy obsahujú len zápasy aktuálneho týždňa; zápas z minulého týždňa otvorený cez odkaz sa zobrazí samostatne (`pastMatchHref` v `MatchExperience`). Horná navigácia (`SiteNav`) sa generuje z aktívnych líg v DB, poradie líg je v `LEAGUE_ORDER` v `src/lib/queries.ts`.

Kľúčové komponenty (`src/components/`):
- `MatchExperience.tsx` — vlastník stavu `selectedMatchId`. Zoznam zápasov, hlavička aj mapa sa pri prepnutí zápasu nikdy neremountujú, menia sa len props.
- `MatchCard.tsx` — karta zápasu v zozname = **tu sa hlasuje**. Obsahuje tri samostatné, nevnorené tlačidlá: domáci tím, hosťujúci tím (hlas = „tomuto tímu fandím“, nie tip na víťaza) a „View map“ (len výber zápasu, nikdy nehlasuje). Samotná karta nemá žiadny klik. Logika hlasovania je v `src/lib/useVote.ts`. Pozri `docs/dev-prompt-chatgpt.md` „CRITICAL INTERACTION RULES“.
- `MatchHeader.tsx` — tenká lišta nad mapou, len zobrazuje (počty, percentá, fajka pri tíme, ktorému fandíš).
- `GlobalMap.tsx` — interaktívna 2D mapa (Mapbox, Mercator, bez Antarktídy). Inštancia sa vytvorí raz; nové výsledky menia len `feature-state`. Sýtosť farby krajiny = sila podpory. Spoločné nastavenia máp sú v `src/lib/mapSetup.ts`, výber knižnice (Mapbox alebo MapLibre) v `src/lib/mapEngine.ts`, zobrazovacie farby tímov v `src/lib/teamColors.ts`.
- `ShareBar.tsx` — zdieľanie (X, Facebook, WhatsApp, Reddit, kopírovanie odkazu) dole na mape.
- `HeroMap.tsx` — dekoratívna mapa na landing page. Kým má zápas málo hlasov, ukazuje **ilustračný** vzor (`src/lib/heroPreview.ts`), ktorý je na stránke tak aj označený.
- `MapInsights.tsx` — legenda a top krajiny pre každý tím.

Server:
- `src/app/api/votes/route.ts` — jediné miesto, kde appka zisťuje IP adresu a krajinu žiadosti. Samotnú validáciu a zápis robí `submit_vote()` v databáze.

## Čo (zámerne) ešte chýba

Pozri `docs/decisions-log.md` pre aktuálny stav. Zhruba: stránky About/Privacy/Contact, vertikálne video pre sociálne siete, skutočný realtime (teraz polling každých 15s).
