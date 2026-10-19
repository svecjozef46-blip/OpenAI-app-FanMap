# FanMap – Tech Stack (návrh)

_Posledná revízia: 2026-09-11 — konkrétny návrh, nie otvorená otázka_

## Kritériá výberu (z business-case.md)
1. Zvládnuteľné pre nedevelopera s pomocou AI (Claude) na písanie kódu
2. Mainstreamové technológie — budúci technický partner/kupec sa v tom musí vedieť rýchlo zorientovať
3. Lacné/zadarmo na štart (MVP bez rozpočtu)
4. Sport-agnostic dátový model (viď idea.md) — netreba prerábať pri pridaní ďalšieho športu

## Návrh (aktuálny, po revízii nižšie)
- **Frontend**: Next.js (React + TypeScript + Tailwind) — najrozšírenejší web framework, obrovská komunita, výborne zdokumentovaný, AI vie s ním pracovať veľmi spoľahlivo, a má vstavané riešenie pre zdieľané náhľady (OG tagy) na sociálnych sieťach — kľúčové pre virálnu slučku appky. Hosting zadarmo na Vercel.
- **Mapa**: Mapbox GL JS (dark-v11 štýl) — WebGL renderovanie zvláda tisíce polygónov (dôležité pre plánovanú regionálnu granularitu, US okresy/EU NUTS), profesionálny dark/premium vzhľad takmer bez extra dizajnérskej práce. Má bezplatný limit, potom platený — treba sledovať využitie. _(Pôvodne navrhované react-simple-maps — zmenené, dôvod nižšie.)_
- **Backend/DB**: Supabase (Postgres) — databáza + API + autentifikácia bez vlastného servera, spravuje sa cez prehľadné webové rozhranie, zadarmo do slušného objemu, extrémne rozšírené (ľahký handoff partnerovi/kupcovi).
- **Ochrana proti duplicitným hlasom (MVP úroveň)**: kombinácia cookie (zariadenie) + hash IP adresy uložený k hlasu, kontrolovaný cez Supabase. Pre B2B/médiá úroveň (Fáza 2) bude treba niečo silnejšie (napr. prihlásenie).
- **Doména a hosting účty**: registrované a vlastnené výhradne na tvoje meno/účet — kvôli čistote vlastníctva pre budúce vyjednávanie.
- **Analytika**: Vercel Analytics alebo Plausible — dôkaz trakcie pre B2B pitch.

## Čo platí o "premium/wow" bez ohľadu na knižnicu
"Wow" rieši dizajn, nie len voľba knižnice. Konkrétne, čo urobí z mapy hlavný "wow" produkt:
- plynulé animované prechody farieb pri zmene výsledku (nie skokové prekreslenie)
- hover/tooltip s počtom hlasov a jemnou mikroanimáciou
- animované "počítadlo" hlasov
- premium farebná paleta a typografia (pri stavbe komponentu použijem dataviz skill)
- voliteľný zoom/pan a dark mode

**Stretch upgrade, zámerne NIE pre MVP:** 3D/WebGL glóbus (štýl Stripe/GitHub globe) — možné vylepšenie na neskôr (napr. pri pitchi technickému partnerovi), nie súčasť prvej verzie.

## Čo zámerne NEPOUŽÍVAME v MVP (a prečo)
- Google Maps API — nevhodné pre tematické vyfarbovanie krajín, aj drahšie než Mapbox pri väčšom trafiku
- Vlastný backend server (Node/Express a pod.) — Supabase to isté pokryje bez potreby spravovať server
- Real-time infraštruktúra (websockets pre live shifty) — patrí až do Fázy 3, nie MVP
- Mobilná natívna appka — web appka (Next.js/PWA) funguje aj na mobile, netreba dve platformy naraz (viď business-case.md – Prečo nie App Store)

## Revízia po ChatGPT dev-prompte
Vlastný detailný dev prompt priniesol dôležité nové informácie, zmenené 2 odporúčania — z konkrétnych dôvodov:

**Mapa: react-simple-maps → Mapbox GL JS.** Dôvod: (1) plánujeme regionálnu granularitu (US okresy, EU NUTS) — pri tisíckach polygónov má WebGL (Mapbox) výrazne lepší výkon než SVG DOM; (2) Mapbox dark-v11 štýl dáva "premium" vzhľad takmer zadarmo. Cena: bezplatný limit, potom platené — treba sledovať využitie, najmä pri virálnom momente.

**Frontend: Vite → Next.js.** Celá virálna slučka stojí na zdieľaní odkazu na konkrétny zápas — čisté Vite SPA bez server-side renderovania ukáže generický náhľad (OG tags) pri zdieľaní. Next.js to rieši vstavane.

**Čo dev prompt rieši výborne a nemením na tom nič:** prísne oddelenie "výber zápasu" vs. "hlasovanie", acceptance testy ako poistka proti regresii, fázovaný postup s potvrdením pred veľkými rozhodnutiami, dátový model LEAGUES/TEAMS/MATCHES/VOTES so sport-agnostic dizajnom, unique constraint na duplicitné hlasy, RLS bezpečnosť.

**Čo v dev prompte chýba a treba doplniť pred stavbou:**
- **Prah dôveryhodnosti pre farbenie krajiny** (viď idea.md) — prompt rieši len "0 hlasov = neutrálna farba", nie "málo hlasov = zavádzajúca 100%".
- **`region_code` pole vo VOTES tabuľke** (viď idea.md) — pripraviť teraz.
- **Základný GDPR/cookie súhlas** — EU publikum + IP-odvodený hash + localStorage preferencie (nie som právnik, len upozorňujem).

## Pripravenosť na regionálnu granularitu (US okresy, EU regióny)
Stack to zvládne bez zmeny (Mapbox GL JS renderuje akékoľvek hranice ako vektorové vrstvy), ale nie ako súčasť MVP. Keď príde na rad (Fáza 2/3):
- hraničné dáta: US Census (Cartographic Boundary Files), Eurostat (NUTS regióny) — obe zadarmo verejné
- pred nasadením zjednodušiť cez mapshaper
- hlasovanie na tejto úrovni prejde z IP geolokácie na vlastný výber regiónu (dropdown), kvôli presnosti
- databáza (Supabase) už od MVP obsahuje nepovinné `region_code` pole

## Otvorené otázky
- názov domény (závisí od výsledku overenia globalfansmap.com / kolízie názvu, viď business-case.md)

## Udržateľnosť a odovzdateľnosť kódu (doplnené 2026-10-19)
Používateľ nie je developer. Appka musí byť postavená tak, aby ju vedel buď sám jednoducho udržiavať (meniť texty, pridávať zápasy cez admin, sledovať chyby), alebo ju neskôr bez trenia odovzdať skúsenému developerovi (v súlade s cieľom z business-case.md — partner/predaj). Toto je teraz záväzná požiadavka na štýl kódu, nie len "pekné by bolo":
- konvenčné, bežne známe vzory (žiadne exotické abstrakcie ani "chytré" skratky) — kód musí vyzerať tak, ako by ho napísal priemerný skúsený React/Next.js developer, nie ako osobná vychytávka
- komentáre pri netriviálnych miestach vysvetľujúce PREČO, nie len čo (napr. prečo je výber zápasu a hlasovanie prísne oddelené — viď dev-prompt-chatgpt.md, toto spôsobilo problémy v minulosti)
- README vždy aktuálny a dostatočný na to, aby cudzí developer rozbehol projekt bez toho, aby sa musel pýtať používateľa
- žiadne tajomstvá/kľúče v kóde — všetko cez .env, presne podľa .env.example
- commit správy popisujúce čo a prečo sa zmenilo (pre budúcu orientáciu, nie len pre mňa)
