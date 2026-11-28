# Mapa cez MapLibre (predvolená od 2026-11-26)

Mapu kreslí **MapLibre GL JS** z dát uložených v repozitári: bez účtu, tokenu, poplatku za spustenie a bez počítadla spustení. Mapbox ostáva ako záloha (fáza 2 ho odstráni najskôr týždeň po nasadení). Rozhodnutia a ich dôvody sú v `docs/decisions-log.md` (2026-11-26), snímky a nástroje na porovnanie v `docs/maplibre-comparison/`.

## Prepínanie

| `NEXT_PUBLIC_MAP_ENGINE` | Čo beží |
|---|---|
| neuvedená, prázdna alebo `maplibre` | MapLibre GL JS (predvolené). Žiadne volanie počítadla spustení, žiadny pruh o pauze. |
| `mapbox` | Mapbox GL JS ako pred prechodom: token `NEXT_PUBLIC_MAPBOX_TOKEN`, počítadlo spustení, pauza pri 49 000. |

Hodnota sa číta pri **builde**: `next.config.ts` ju vždy vloží do kódu (aj keď premenná chýba), takže nepoužitý engine sa do buildu vôbec nedostane. Po zmene vo Verceli treba nasadiť znova (Deployments → Redeploy).

## Ako je to postavené

- `src/lib/mapEngine.ts` — prepínač, tenké rozhranie enginov (`createMap`, `Popup`, `NavigationControl`, `setupLayers`, `country`, `outline`) a `preloadMapData()`. `GlobalMap` a `HeroMap` sú spoločné pre oba enginy.
- `src/lib/mapSetup.ts` — spoločný vzhľad: vrstvy krajín (`countryLayers()`, rovnaké ID a výrazy pre oba enginy), farby `MAP_PALETTE`, `fitWorld()`.
- `src/lib/mapEngineMaplibre.ts` — štýl zostavený v kóde: žiadny podklad, oceány priehľadné, vrstvy krajín a vrstva názvov `country-label`. Dáta sa stiahnu raz na návštevu (`loadCountryData()`, spoločné pre úvodnú mapu aj mapu zápasu) a mapa sa vytvorí až potom, takže nikdy nezačne prázdna. Úvodná mapa kreslí hranice z druhej kópie tých istých tvarov (zdroj `country-outlines`, `outline()` v rozhraní enginu): MapLibre pri každej zmene stavu krajiny prepočíta všetky vrstvy, ktoré stav čítajú, a animácia mení výplň každú snímku, hranicu len raz. Podrobnosti v časti [Presnosť tvarov](#presnosť-tvarov).
- `src/lib/mapAssets.ts` — **generovaný** súbor s aktuálnymi menami dátových súborov (nemeniť ručne).

## Dáta a vyrovnávacia pamäť

Všetko vyrába `node scripts/build-countries.mjs` (zdroje si raz stiahne do `scripts/.cache/`, výsledok je v repozitári):

| Súbor | Obsah |
|---|---|
| `public/data/countries.<hash>.topo.json` | tvary krajín (TopoJSON), id = ISO alfa-2 ako `votes.country_code` |
| `public/data/country-labels.<hash>.geo.json` | bod, názov, plocha a poradie popisky pre každú krajinu |
| `public/fonts/<hash>/<písmo>/0-255.pbf` | glyphs písma popiskov |

- **Hash v mene** sa mení s obsahom, preto `next.config.ts` (`headers()`) posiela pre `/data/*` a `/fonts/*` `Cache-Control: public, max-age=31536000, immutable`: prehliadač si súbory nechá rok a pri ďalšej stránke alebo návšteve ich už nesťahuje. Skript pri novom builde staré súbory zmaže; aplikácia berie mená z `src/lib/mapAssets.ts`.
- **TopoJSON**: každá hranica je uložená raz (nie raz za každého suseda) a súradnice ako malé celé čísla na mriežke 500 000 × 500 000 (~70 m). Prehliadač ho prevedie na GeoJSON (`topojson-client`, ~3 KB).
- **Prípony `.json`**: neznámu príponu (napr. `.topojson`) Vercel posiela ako `application/octet-stream` a nekomprimuje ju. Glyphs naopak nechávame na predvolenom type: ako `application/octet-stream` ich Vercel komprimuje (40 KB), ako `application/x-protobuf` nie (74 KB); overené na nasadenej verzii.
- **Preload**: stránky s mapou majú `<link rel="preload">` na tvary krajín (a na stránke zápasu aj na popisky a glyphs), takže sťahovanie začne spolu so stránkou.

### Veľkosti (prenesené z Vercelu, `content-encoding: br`)

| | Pred (2026-11-26, PR #2) | Po |
|---|---|---|
| Tvary krajín | 620 KB (GeoJSON, `max-age=0, must-revalidate`) | **329 KB** (TopoJSON, `immutable`) |
| Popisky | 6 KB | 8 KB |
| Glyphs | 41 KB (Open Sans) | 44 KB (Barlow) |
| Pri ďalšej stránke / návšteve | overenie každého súboru so serverom | 0 B (cache prehliadača) |

## Tvary krajín

- **Zdroj:** Natural Earth 1:10m Admin 0 Countries, vydanie „point of view: United States“, verzia v5.1.2. **Public domain**; na mape je atribúcia „MapLibre | Natural Earth“.
- **Prečo 10m US:** 110m nemá Maltu, Singapur, Monako ani ďalšie malé štáty; 50m existuje len v pohľade „de facto“ (samostatný Somaliland, Severný Cyprus). US vydanie je len v 10m, preto sa zjednodušuje.
- **Zjednodušenie podľa veľkosti krajiny:** tolerancia úmerná veľkosti (asi 80 m mikroštáty, 200 m Luxembursko, 900 m Slovensko, najviac 4 km Rusko či Kanada). Rovnaké percento pre všetky krajiny robilo z Malty trojuholník a mazalo Gozo.
- **Najväčšie priblíženie: zoom 7** (Luxembursko na celej obrazovke notebooku). Ďalej by pobrežia Natural Earth pôsobili hrubo oproti Mapboxu a na fanúšikovskej mape ulice netreba. Prechod na podrobnejšie dáta pri priblížení sme neurobili: druhý zdroj by pridal ~1–2 MB a takmer nikto na mape tak ďaleko nepribližuje.
- **180. poludník:** Natural Earth delí Rusko a Fidži na ±180°. Skript presunie ich časti tesne západne od 180° na 180–191° v. d. a spojí ich so zvyškom krajiny, takže na oboch mapách (169° z. d. – 191° v. d., `frameWorld()` v `src/lib/mapSetup.ts`) je Čukotka celá a bez čiary rezu. Podrobne: [maplibre-comparison/fidelity.md](maplibre-comparison/fidelity.md#180-poludník-čukotka-aleuty-fidži-kiribati).
- **ISO kódy:** `ISO_A2_EH` namiesto `ISO_A2` (ten je pri Francúzsku či Nórsku `-99`), zvyšok tabuľka v skripte. Zámorské územia s vlastným kódom (Réunion, Guadeloupe, Svalbard, Karibské Holandsko…) sú samostatné ako v Mapboxe. Bez tvaru sú len `AQ` (Antarktída, zámerne) a `BV` (neobývaný Bouvetov ostrov). Kontrola: `node scripts/check-country-codes.mjs --all`, test `tests/map-data.test.ts`.
- **Sporné hranice:** jeden pevný pohľad „US worldview“ ako pri Mapboxe (Krym = Ukrajina, Abcházsko a Južné Osetsko = Gruzínsko, Somaliland = Somálsko, Severný Cyprus = Cyprus, Kosovo a Taiwan samostatne, Západná Sahara samostatne, Golanské výšiny = Izrael, Kašmír podľa línií kontroly).

## Presnosť tvarov

Vykreslený obrys krajiny sa od zdrojových tvarov odchyľuje najviac o 1 pixel obrazovky pri každej veľkosti okna (390–3840 px) a hustote pixelov (DPR 1–3), na úvodnej mape aj na mape zápasu (merané 2026-11-27: 0,57–0,80 px; úplne presné vykreslenie má 0,50 px). Podrobne, s metodikou a stavom pred zmenou: [maplibre-comparison/fidelity.md](maplibre-comparison/fidelity.md).

- **Zjednodušenie pri rezaní na dlaždice:** tolerancia 0,125 na pixel zariadenia (`shapeTolerance()` v `src/lib/mapEngineMaplibre.ts`; MapLibre má predvolene 0,375 bez ohľadu na DPR). Úvodná mapa mala do 27. 11. 2026 toleranciu 1,5 – na širokej obrazovke to boli zubaté pobrežia (až 7 px).
- **Plátno do 8192 px** (`maxCanvasSize`), aby sa mapa na 5K displeji nekreslila v nižšom rozlíšení a nerozmazala.
- **Kontrola po zmene:** `node docs/maplibre-comparison/tools/shape-fidelity.cjs http://localhost:3000 out.json` proti `npm run dev` a porovnať s tabuľkou vo `fidelity.md`.

## Popisky krajín

- **Štýl zrkadlí Mapbox `dark-v11`** (vrstva `country-label`, prečítaná zo štýlu, ktorý načítava naša Mapbox mapa): bez veľkých kapitálok a rozostupov, 11 / 9 / 8 px pri zoome 1 podľa poradia krajiny (`symbolrank` = `LABELRANK` z Natural Earth) až 22 / 19 / 17 px pri zoome 9 po rovnakej krivke, šírka 6 em, výška riadku 1,1, obrys 1,25, žiadne popisky na telefóne (celý svet je tam pod zoomom 0). Mapbox začína pri zoome 1; my pri 0,75, inak by notebook 1280 × 720 (svet pri zoome ~0,9) nemal žiadnu popisku. Najväčšie písmo (11 px) dostanú len krajiny nad 500 000 km².
- **Poradie podľa dôležitosti:** pri kolízii vyhrá väčšia krajina (`symbol-sort-key` = plocha). Deväť futbalových krajín v preplnených oblastiach (Kamerun, Ghana, Senegal, Pobrežie Slonoviny, Nigéria, Tunisko, Južná Kórea, Uruguaj, Kostarika) má prednosť, akoby boli štyrikrát väčšie, inak by ich vytlačili plošne väčší, futbalovo tichší susedia. Kedy sa popiska objaví, určuje plocha: krajiny nad 100 000 km² už pri pohľade na celý svet, 50–100 tisíc od zoomu 2, menšie postupne, mikroštáty od zoomu 5; menšie závislé územia o úroveň neskôr.
- **Poloha:** ručne umiestnené body Natural Earth (`LABEL_X/Y`, nie ťažisko), s opravami pre Taliansko, Chorvátsko a Nórsko. Keď popiska na bode nemá miesto, môže sa posunúť tesne vedľa neho (ako v Mapboxe). Vďaka tomu je pri pohľade na celý svet (1440 × 900) popísaných 97 krajín namiesto 67.
- **Zdroj popiskov bez okraja dlaždice (`buffer: 0`):** s okrajom sa bod blízko hrany dlaždice (rovník, nultý poludník) dostal do dvoch dlaždíc a s `symbol-sort-key` jedna kópia vyradila druhú. Tak zmizli napr. Tanzánia, Ekvádor či Spojené kráľovstvo.
- **Písmo: Barlow Semi Condensed SemiBold** (SIL Open Font License 1.1, text licencie je pri glyphs). DIN Pro z Mapboxu je licencované a mimo Mapboxu sa použiť nedá. Porovnané na rovnakom výreze proti DIN Pro: Open Sans Semibold (pôvodné; široké, „štandardné“), Barlow Condensed Medium (príliš úzke), Barlow Semi Condensed Medium (tenšie než DIN) a SemiBold. SemiBold má najbližšiu hrúbku aj šírku a dobre sa číta aj pri 8 px. Glyphs vyrába `scripts/build-glyphs.mjs` priamo z TTF súboru Google Fonts (pevný commit), v čistom Node bez prehliadača.
- **Názvy** z `Intl.DisplayNames` (rovnaký zdroj ako tooltip), s pár skráteniami („DR Congo“, „Bosnia and Herzegovina“…).

### Kontrolný zoznam popiskov (1440 × 900, tmavý režim)

`node docs/maplibre-comparison/tools/labels.cjs http://localhost:3000` (pri `npm run dev`) vypíše popísané krajiny a tie, ktoré by mali byť popísané a nie sú:

| Pohľad | Popísaných | Chýba (nad prahom plochy) |
|---|---|---|
| Celý svet (zoom 1,13), prah 100 000 km² | 97 | Gabon, Malawi, Zambia, Benin, Central African Rep., Eritrea, Laos, South Sudan, Tajikistan, Burkina Faso |
| Európa (zoom 3,13), prah 10 000 km² | 55 | Kosovo |
| Ázia (zoom 2,13), prah 50 000 km² | 85 | Gabon, Malawi, Bosnia and Herzegovina, Central African Rep. |
| Južná Amerika (zoom 2,13), prah 50 000 km² | 55 | Gabon, Central African Rep., Togo, French Guiana |

Chýbajúce krajiny ležia v najhustejšej časti Afriky a v Strednej Ázii, kde sa pri tejto veľkosti písma fyzicky nezmestia (aj Mapbox ich v rovnakom pohľade vynecháva) a objavia sa pri prvom priblížení. Na 1920 × 1080 chýbajú pri pohľade na svet len Malawi a Ghana (105 popiskov), na 1280 × 720 je ich 94. Úplné zoznamy popísaných krajín sú v pull requeste.

## Pohyb a správanie

- **Farby** (nový hlas, prepnutie zápasu, svetlý/tmavý režim) prechádzajú plynulo 450 ms namiesto skoku. Žiadna z knižníc neanimuje `feature-state`, preto prechod riadi `applyResults()` v `GlobalMap` snímku po snímke, rovnako ako `HeroMap`. Pri `prefers-reduced-motion` sa farby menia okamžite.
- **Prvé vykreslenie:** mapa je skrytá, kým nemá nakreslený svet aj s farbami, potom sa plynulo objaví. Text „Loading the map…“ sa ukáže až po 0,8 s, takže pri rýchlom načítaní ho nikto nevidí.
- **Hover:** obrys a tooltip zmiznú aj pri opustení mapy priamo z krajiny (napr. na hlavičku).
- **Telefón:** `cooperativeGestures`: jeden prst posúva stránku, mapa ukáže „Use two fingers to move the map“.
- **Odolnosť:** keď sa dáta mapy nenačítajú (sieť, blokátor), mapa ukáže zrozumiteľnú hlášku a zoznam zápasov aj hlasovanie fungujú ďalej. Po strate grafického kontextu (iOS Safari na pozadí) sa mapa obnoví aj s farbami.
- **Prepnutie zápasu** mení len farby, mapa sa nevytvára znova (overené: rovnaký `<canvas>` pred aj po).
- **Ovládacie prvky** (+/−, vysvetlivka, zdieľanie, hlavička) neprekrývajú žiadnu popisku pri pohľade na svet na 10 veľkostiach obrazovky od telefónu po 2560 × 1440 (`docs/maplibre-comparison/tools/overlaps.cjs`).
- **Prístupnosť:** mapa je oblasť s názvom „World map: the team each country supports“, ovládateľná klávesnicou (šípky, +/−) ako predtým.

## Výkon (meranie 2026-11-26)

Studené načítanie stránky zápasu (prázdna cache), 5 meraní, medián; všetko na Verceli, ten istý prehliadač a sieť; bajty prenesené (po kompresii) vrátane požiadaviek web workerov. Nástroje: `docs/maplibre-comparison/tools/perf.cjs` a `hero-fps.cjs`.

| | Mapbox (produkcia) | MapLibre pred (PR #2) | **MapLibre teraz** |
|---|---|---|---|
| JavaScript | 757 KB | 513 KB | 516 KB |
| Mapové dáta | 424 KB | 613 KB | **331 KB** |
| Písmo názvov | 128 KB | 40 KB | 45 KB |
| Ostatné | 113 KB | 117 KB | 117 KB |
| **Spolu** | **1 422 KB** | **1 283 KB** | **1 009 KB** |
| Ďalšia stránka / návšteva (dáta mapy) | podľa cache Mapboxu | overenie so serverom | **0 B** |
| Čas do zobrazenia mapy (medián, rozptyl) | 2,41 s (2,3–4,2) | 2,56 s (2,3–3,6) | 2,83 s (2,7–3,7) |
| Úvodná animácia pri 4× spomalenom CPU | 18 snímok/s, najdlhšia 350 ms | — | 14 snímok/s, najdlhšia 133 ms |

- MapLibre stiahne o 29 % menej než Mapbox. Pri opakovanej návšteve nesťahuje dáta mapy vôbec.
- Čas do zobrazenia je o ~0,3–0,4 s dlhší než pri Mapboxe. MapLibre musí pred prvým vykreslením rozrezať tvary celého sveta na dlaždice, kým Mapbox dostane hotové dlaždice zo servera. Rozdiely sú menšie než rozptyl medzi meraniami. Zlepšenia v tejto práci: GeoJSON ide do workera ako text (blob URL), nie kopírovaním objektu (~100 ms na hlavnom vlákne), a predvolené zjednodušovanie MapLibre pri malom priblížení (s vypnutým bolo zobrazenie o ~20 % pomalšie).
- Úvodná animácia (stav 26. 11.): priemerne o niečo menej snímok, ale rovnomernejšie (najdlhšia snímka 133 ms oproti 350 ms pri Mapboxe). Absolútne čísla sú nízke, lebo testovacie prostredie kreslí WebGL softvérovo; porovnávať treba len medzi sebou.
- **Od 27. 11. 2026** majú obe mapy presnejšie tvary (pozri [Presnosť tvarov](#presnosť-tvarov)) a čísla v tabuľke vyššie už neplatia pre úvodnú mapu ani čas do zobrazenia: na softvérovom WebGL je animácia pomalšia a mapa sa zobrazí o ~0,7–1 s neskôr, JavaScript na snímku animácie je však na úrovni pôvodného stavu a prenesené bajty sú rovnaké. Meranie a vysvetlenie: [maplibre-comparison/fidelity.md](maplibre-comparison/fidelity.md#plynulosť-animácie-a-načítanie).

## Známe rozdiely oproti Mapboxu

- **Detail pri veľkom priblížení:** od zoomu ~6 (Luxembursko, okolie Singapuru) sú hranice veľkých krajín a ich malé ostrovy jednoduchšie než v Mapboxe; preto je najväčšie priblíženie 7. Malé štáty samotné (Luxembursko, Malta s Gozom, Singapur, Kosovo, Lichtenštajnsko, Monako) majú tvar v poriadku. Pobrežie Nórska a Grónska je pri priblížení menej členité.
- **Popisky:** viac krajín s popiskou, ale pri pohľade na svet menšie písmo (8–9 px pri krajinách pod 500 000 km²) a niektoré názvy posunuté vedľa svojej krajiny. Mapbox ukáže menej názvov, väčšie.
- **Písmo:** Barlow Semi Condensed SemiBold namiesto DIN Pro (pozri vyššie). Názvy podľa `Intl` („Türkiye“, „Czechia“, „DR Congo“).
- **Atribúcia:** „MapLibre | Natural Earth“ namiesto loga Mapbox a „© Mapbox © OpenStreetMap“.
- **Telefón:** pri pohľade na celý svet bez názvov krajín (rovnako ako Mapbox).
- **Hranice:** rovnaký „US“ pohľad; drobné rozdiely v priebehu hraníc (iný zdroj dát), v príslušnosti kontrolovaných sporných území žiadne.

## Ako aktualizovať dáta

1. Uprav `scripts/build-countries.mjs` (verzia Natural Earth, kódy, zjednodušenie, prahy popiskov) alebo písmo (`FONT`, `scripts/build-glyphs.mjs`).
2. `node scripts/build-countries.mjs` (vypíše veľkosti a prepíše `src/lib/mapAssets.ts`).
3. `node scripts/check-country-codes.mjs --all` a `npm test`.
4. Pozri mapu cez `npm run dev`; zoznam popiskov cez `docs/maplibre-comparison/tools/labels.cjs`.
