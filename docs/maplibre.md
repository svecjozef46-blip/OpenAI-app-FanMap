# MapLibre verzia mapy

Druhý mapový engine vedľa Mapboxu. Mapbox ostáva predvolený; MapLibre sa zapína jednou premennou. Rozhodnutia a výsledky porovnania sú v `docs/decisions-log.md` (2026-11-26).

## Prepínanie

| `NEXT_PUBLIC_MAP_ENGINE` | Čo beží |
|---|---|
| neuvedená, prázdna alebo `mapbox` | Mapbox GL JS, presne ako doteraz (token, počítadlo spustení, pauza pri 49 000) |
| `maplibre` | MapLibre GL JS, bez tokenu, bez účtu, bez poplatku a bez počítadla spustení |

Premenná sa číta pri **builde** (Next.js ju vloží do JavaScriptu), takže po zmene vo Verceli treba nasadiť znova. Do prehliadača sa dostane len kód zvoleného enginu: každý je v samostatnom module (`src/lib/mapEngineMapbox.ts`, `src/lib/mapEngineMaplibre.ts`), ktorý sa načíta cez `import()` až keď je potrebný.

## Ako je to postavené

- `src/lib/mapEngine.ts` — prepínač a tenké rozhranie (`createMap`, `Popup`, `NavigationControl`, `setupLayers`, `country`). `GlobalMap` a `HeroMap` sú spoločné pre oba enginy, nič sa nekopíruje.
- `src/lib/mapSetup.ts` — spoločný vzhľad: vrstvy krajín (`countryLayers()`, rovnaké ID a rovnaké výrazy pre oba enginy), farby `MAP_PALETTE`, `fitWorld()`. Mapbox cesta (`tidyBaseStyle`, `addCountryLayers`, tileset `mapbox.country-boundaries-v1`) je bez zmeny správania.
- `src/lib/mapEngineMaplibre.ts` — štýl zostavený v kóde: žiadny podklad, oceány priehľadné, zdroj krajín z `public/data/countries.geojson` (`promoteId: "code"`, takže `setFeatureState` funguje s ISO kódom rovnako ako pri Mapboxe), vrstva názvov `country-label` z `public/data/country-labels.geojson` a písmo z `public/fonts/`.
- Počítadlo spustení (`claimMapLoad`, `/api/map-load`) sa pri MapLibre nevolá a stav „paused“ mapu neskryje. Pruh `PausedBanner` a pauza hlasovania v `/api/votes` sa nemenili. Pozor: keďže MapLibre spustenia nepripočítava, pauza sa pri MapLibre už sama nespustí; ak by bol mesiac v čase prepnutia už pozastavený, hlasovanie ostane pozastavené do 1. dňa ďalšieho mesiaca (alebo stačí zvýšiť `MAP_LOAD_LIMIT`).

## Dáta: tvary krajín

Vyrába ich `scripts/build-countries.mjs` (spustenie: `node scripts/build-countries.mjs`, potrebuje internet len na prvé stiahnutie zdroja do `scripts/.cache/`). Výsledok je v repozitári, appka za behu nič zo sveta nesťahuje.

- **Zdroj:** Natural Earth 1:10m Admin 0 Countries, vydanie „point of view: United States“ (`ne_10m_admin_0_countries_usa`), verzia v5.1.2. **Public domain**, atribúcia nie je povinná; na mape je odkaz „Natural Earth“ v rohu.
- **Prečo 10m US a nie hotové 50m/110m:** 110m nemá Maltu, Singapur, Monako ani ďalšie malé štáty. 50m ich má, ale len v „de facto“ pohľade (samostatné Somaliland, Severný Cyprus). US vydanie existuje len v 10m, preto sa 10m zjednoduší a súradnice sa zaokrúhlia na 0,001° (~100 m).
- **Zjednodušenie podľa veľkosti krajiny:** každá krajina má vlastnú toleranciu úmernú svojej veľkosti (asi 80 m pre mikroštáty, 200 m Luxembursko, 900 m Slovensko, najviac 4 km Rusko či Kanada). Porovnané na obrazovke s Mapboxom: rovnaké percento pre všetky krajiny (4 %, 15 %, 25 %) buď pôsobilo hranato pri priblížení na Luxembursko, alebo z Malty urobilo trojuholník a Gozo zmizlo, lebo najviac uberá z najmenších tvarov.
- **Veľkosť:** 1,8 MB, po gzip kompresii (Vercel ju robí automaticky) asi 0,6 MB, 248 krajín. Pre porovnanie: 4 % = 430 KB, 15 % = 1,4 MB, 25 % = 2,3 MB.
- **ISO kódy:** `ISO_A2` je v Natural Earth pri niektorých krajinách `-99` (Francúzsko, Nórsko, Kosovo…), preto sa používa `ISO_A2_EH`; zvyšok rieši tabuľka podľa `ADM0_A3` v skripte (napr. britské základne na Cypre → `CY`, Guantánamo → `CU`). Vynechané: Antarktída (`AQ`), Bir Tawil, Spratlyho ostrovy, Scarborough Shoal (neobývané, bez kódu).
- **Zámorské územia s vlastným kódom** (Réunion `RE`, Guadeloupe `GP`, Martinik `MQ`, Francúzska Guyana `GF`, Mayotte `YT`, Svalbard `SJ`, Karibské Holandsko `BQ`, Tokelau `TK`, Vianočný ostrov `CX`, Kokosové ostrovy `CC`) Natural Earth kreslí ako súčasť materskej krajiny. Skript ich oddelí, aby hlas napr. z Réunionu vyfarbil Réunion, nie celé Francúzsko (tak to má aj Mapbox).
- **Sporné hranice:** jeden pevný pohľad, „US worldview“ (rovnaký, aký používame pri Mapboxe). Abcházsko a Južné Osetsko sú súčasťou Gruzínska, Somaliland Somálska, Severný Cyprus Cypru, Krym Ukrajiny, Kosovo je samostatné (`XK`), Taiwan samostatný (`TW`), Západná Sahara samostatná (`EH`), Golanské výšiny Izraela, Kašmír rozdelený podľa línií skutočnej kontroly (Aksai Chin Čína, pakistanská časť Pakistan, indická India). Overené bodmi priamo vo výslednom súbore.

### Kontrola kódov

```bash
node scripts/check-country-codes.mjs --all
```

Vypíše ISO kódy bez tvaru na mape. Kódy reálne uložené v `votes` sa dajú overiť tak, že v Supabase SQL editore spustíš `select string_agg(distinct country_code, ' ') from votes;` a výsledok dáš skriptu ako argumenty. To isté kontroluje aj test `tests/map-data.test.ts` (`npm test`).

Stav k 2026-11-26: v `votes` je len `SK` (má tvar). Z celého zoznamu ISO 3166-1 + `XK` chýba tvar len pre `AQ` (Antarktída, zámerne) a `BV` (Bouvetov ostrov, neobývaný, Natural Earth ho v US vydaní nemá).

## Písmo pre názvy krajín

- **Open Sans Semibold**, licencia **Apache License 2.0** (text licencie je v `public/fonts/Open Sans Semibold/LICENSE.txt`). Glyphs (`.pbf`) sú z projektu openmaptiles/fonts, pevný commit uvedený v skripte.
- Uložený je len rozsah `0-255` (latinka vrátane diakritiky v anglických názvoch krajín, 76 KB); skript stiahne aj ďalšie rozsahy, ak by ich niektorý názov potreboval.
- Mapbox používa písmo DIN Pro (licencované, nedá sa použiť mimo Mapboxu). Open Sans Semibold je najbližšia voľná náhrada z dostupných sád; písmo je mierne širšie a oblejšie.
- Názvy sú z `Intl.DisplayNames` (rovnaký zdroj ako tooltip, `countryName()`), s pár skráteniami pre mapu („DR Congo“, „Bosnia and Herzegovina“…).

## Výkon (meranie 2026-11-26)

Studené načítanie stránky zápasu (prázdna cache), 5 meraní, medián. Všetko na Verceli (produkcia a preview), rovnaký prehliadač a sieť. Bajty = prenesené (po kompresii), vrátane požiadaviek z web workerov (dlaždice, tvary krajín).

| | Mapbox, `main` (produkcia) | Mapbox s touto zmenou (preview bez premennej) | MapLibre (preview) |
|---|---|---|---|
| JavaScript | 748 KB | 757 KB | 513 KB |
| Mapové dáta (štýl, dlaždice / tvary krajín) | 424 KB | 424 KB | 613 KB |
| Písmo názvov (glyphs) | 128 KB | 128 KB | 40 KB |
| Ostatné (stránka, CSS, webové písma, API) | 114 KB | 114 KB | 117 KB |
| **Spolu** | **1 414 KB** | **1 423 KB** | **1 283 KB** |
| Čas do zobrazenia mapy (medián) | 2,67 s | 2,90 s | 3,01 s |

- Mapbox cesta s touto zmenou stiahne o 9 KB JavaScriptu viac (+1 %: knižnica sa načítava ako samostatný blok cez `import()`). Časy Mapboxu sa medzi meraniami prekrývajú (2,4–3,5 s), rozdiel je v šume.
- MapLibre stiahne spolu o ~130 KB menej, ale tvary krajín (613 KB) sú väčšie než Mapbox dlaždice pre pohľad na svet a prehliadač ich musí celé spracovať, preto je mapa hotová asi o 0,1–0,3 s neskôr. Pri ďalšej návšteve ide GeoJSON z cache prehliadača (Vercel ho len overí).

## Známe rozdiely oproti Mapboxu

- **Detail pri veľkom priblížení:** od zoomu ~6 (Luxembursko, okolie Singapuru) sú hranice veľkých krajín a malé ostrovy veľkých krajín jednoduchšie než v Mapboxe (Natural Earth 10m je hrubší než dáta Mapboxu, a navyše sa zjednodušuje kvôli veľkosti súboru). Malé štáty samotné (Luxembursko, Malta s Gozom, Singapur, Kosovo, Monako) majú tvar v poriadku.
- **Písmo popiskov:** Open Sans Semibold namiesto DIN Pro; o niečo širšie písmo. Názvy podľa `Intl` („Türkiye“, „Czechia“), Mapbox má vlastné, väčšinou rovnaké.
- **Výber popiskov:** pravidlá sú nastavené tak, aby sa hustotou podobali Mapboxu, ale konkrétne krajiny s popiskom sa miestami líšia (napr. pri pohľade na Európu MapLibre ukáže „Iceland“ či „Malta“, Mapbox iné).
- **Atribúcia:** „Natural Earth“ namiesto loga Mapbox a „© Mapbox © OpenStreetMap“.
- **Hranice:** rovnaký „US“ pohľad; drobné rozdiely v priebehu hraníc (rôzne zdroje dát), žiadne rozdiely v tom, ktorá krajina komu patrí, sme pri kontrolovaných sporných územiach nenašli.

## Ako aktualizovať dáta

1. Zmeň v `scripts/build-countries.mjs` čo treba (verzia Natural Earth, mapovanie kódov, úroveň zjednodušenia).
2. `node scripts/build-countries.mjs`
3. `node scripts/check-country-codes.mjs --all` a `npm test`.
4. Pozri mapu s `NEXT_PUBLIC_MAP_ENGINE=maplibre` v `.env.local`.
