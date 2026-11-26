# Mapbox vs MapLibre: snímky z 2026-11-26

Každý obrázok: vľavo **Mapbox** (produkcia, vetva `main`), vpravo **MapLibre** (vetva `maplibre-alt`, `NEXT_PUBLIC_MAP_ENGINE=maplibre`). Zápas Hamburger SV – Bayern Munich, rovnaká veľkosť okna, rovnaké priblíženie (dvojklik na to isté miesto).

- `real-votes-*` — skutočné hlasy z databázy. Pre tento zápas sú to 2 hlasy zo Slovenska, čo je pod prahom 3 (`MIN_VOTES_TO_COLOR`), takže Slovensko je šedé („nerozhodnuté“) v oboch verziách.
- `demo-*` — **ukážkové výsledky** (54 krajín vrátane Luxemburska, Malty, Kosova, Singapuru, Monaka), podstrčené obom verziám rovnako počas snímania, aby bolo vidieť farby tímov, sýtosť podľa náskoku a malé štáty. V databáze nič nie je.
- `home-hero-dark-light.jpg` — mapa na úvodnej stránke po animácii „rozsvietenia“: hore tmavý režim, dole svetlý; vľavo Mapbox, vpravo MapLibre.

Pohľady: celý svet, Európa, Slovensko (s tooltipom pri hoveri), Luxembursko, Malta, Kosovo, Singapur; počítač (1440×900) a telefón (390×844), tmavý a svetlý režim. Kompletná sada (56 snímok) sa dá zopakovať skriptom, ktorý je popísaný v pull requeste.

## Ako snímky a meranie zopakovať

Skripty sú v `tools/` (potrebujú Playwright s Chromiom; nie sú súčasťou appky ani `npm test`):

- `node tools/shots.cjs <mapbox|maplibre> <adresa appky> <priečinok> [demo]` — všetky pohľady; `demo` podstrčí ukážkové výsledky. Filtrovať sa dá premennými `VIEWS=europe,malta` a `KEYS=desktop-dark`.
- `python3 tools/compose.py <priečinok so snímkami> <výstup>` — spojí dvojice vedľa seba.
- `node tools/perf.cjs <názov> <adresa> [počet]` — prenesené bajty a čas do zobrazenia mapy.

Pozor: snímanie produkcie (Mapbox) pripočíta spustenia do produkčného počítadla mapy, každý pohľad jedno.
