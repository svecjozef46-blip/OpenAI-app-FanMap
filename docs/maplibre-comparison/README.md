# Mapbox vs MapLibre: snímky a nástroje

Snímky z 2026-11-26 (fáza 1 prechodu na MapLibre). Na každom obrázku je vľavo **Mapbox** (produkcia) a vpravo **MapLibre** (vetva `maplibre-default`). Zápas Hamburger SV – Bayern Munich, rovnaká veľkosť okna, rovnaké priblíženie (dvojklik na to isté miesto).

- `real-votes-*` — skutočné hlasy. Pre tento zápas sú to 2 hlasy zo Slovenska, pod prahom 3 (`MIN_VOTES_TO_COLOR`), takže Slovensko je v oboch verziách šedé („nerozhodnuté“).
- `demo-*` — **ukážkové výsledky** (54 krajín vrátane malých štátov), podstrčené obom verziám rovnako len v prehliadači počas snímania. V databáze nič nie je.
- Pohľady: celý svet, Európa, Ázia, Južná Amerika, Slovensko (s tooltipom), Luxembursko, Malta, Kosovo, Singapur; počítač (1440 × 900) a telefón (390 × 844); tmavý a svetlý režim. Plná sada (72 snímok) sa dá zopakovať nástrojmi nižšie.
- `home-hero-dark-light.jpg` — úvodná stránka po animácii „rozsvietenia“.
- `label-fonts.jpg` — porovnanie písiem popiskov s DIN Pro z Mapboxu (výrez pohľadu na svet, 2× zväčšené).

## Nástroje (`tools/`, potrebujú Playwright s Chromiom; nie sú súčasťou appky ani `npm test`)

| Skript | Čo robí |
|---|---|
| `shots.cjs <názov> <adresa> <priečinok> [demo]` | snímky všetkých pohľadov; `VIEWS=europe,malta`, `KEYS=desktop-dark` obmedzia výber |
| `compose.py <priečinok> <výstup>` | spojí dvojice Mapbox/MapLibre vedľa seba |
| `labels.cjs <adresa> [šírka] [výška]` | ktoré krajiny majú popisku vo svete, Európe, Ázii a Južnej Amerike a ktoré chýbajú (potrebuje `npm run dev`) |
| `overlaps.cjs <adresa>` | či ovládacie prvky neprekrývajú popisky, na 10 veľkostiach obrazovky (`npm run dev`) |
| `perf.cjs <názov> <adresa> [počet]` | prenesené bajty a čas do zobrazenia mapy |
| `hero-fps.cjs <adresa> [spomalenie CPU] [okno, napr. 390x844]` | plynulosť úvodnej animácie (snímky/s, JavaScript na snímku, čas do zobrazenia) a správanie pri obmedzenom pohybe |
| `shape-fidelity.cjs <adresa> [výstup.json]` | o koľko pixelov sa vykreslené obrysy krajín líšia od zdrojových tvarov, obe mapy, 6 veľkostí okna × DPR 1 a 2 (`npm run dev`); pozri [fidelity.md](fidelity.md) |
| `fidelity-table.cjs pred=a.json po=b.json` | tabuľky do `fidelity.md` z výsledkov `shape-fidelity.cjs` |
| `load-faults.cjs <adresa>` | studené načítanie úvodnej a zápasovej mapy, keď jedna požiadavka mapy raz zlyhá alebo mešká 5 s: či a kedy sa mapa vykreslí |
| `fps-table.cjs <výsledky.jsonl>` | tabuľka z viacerých behov `hero-fps.cjs` |
| `hero-shots.cjs <priečinok> <pred> <po> <dev adresa>` + `compose-hero.py` | snímky úvodnej mapy pred/po a zväčšené výrezy (Kanada, Austrália, Indonézia, Nórsko) |
| `preview-check.cjs <adresa>` | engine, žiadne požiadavky na Mapbox, hover, hlas (zodpovedaný v prehliadači, nič sa nezapíše), prepnutie zápasu a témy, nápoveda dvoch prstov na telefóne |

Chránený preview: adresa so `?_vercel_share=…`. Pozor: snímanie produkcie pri Mapboxe pripočíta spustenia do produkčného počítadla mapy (každý pohľad jedno).
