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
| `hero-fps.cjs <adresa> [spomalenie CPU]` | plynulosť úvodnej animácie a správanie pri obmedzenom pohybe |
| `preview-check.cjs <adresa>` | engine, žiadne požiadavky na Mapbox, hover, hlas (zodpovedaný v prehliadači, nič sa nezapíše), prepnutie zápasu a témy, nápoveda dvoch prstov na telefóne |

Chránený preview: adresa so `?_vercel_share=…`. Pozor: snímanie produkcie pri Mapboxe pripočíta spustenia do produkčného počítadla mapy (každý pohľad jedno).
