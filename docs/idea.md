# FanMap – Idea (v2, revidované)

_Posledná revízia: 2026-09-11 — nahrádza pôvodný ChatGPT draft (viď idea-original-chatgpt.md), rieši identifikované riziká_

## Problém
Fanúšikovia chcú vidieť a porovnať, kde má ich klub globálnu podporu, a zdieľať to — ale dnešné "ktorý tím fandíš" ankety na sociálnych sieťach sú jednorazové, zomrú v feede a nedajú sa preskúmať ani porovnať v čase.

## Cieľová skupina
Primárne futbaloví fanúšikovia (silné medzinárodné fanbase kluby), postupne rozšíriteľné o ďalšie športy — bez nutnosti prerábať dátový model neskôr (viď nižšie).

## Riešenie / Koncept
Interaktívna svetová mapa k jednotlivým zápasom: krajiny sfarbené podľa toho, ktorý klub má viac hlasov od fanúšikov z danej krajiny. Používatelia môžu mapu preskúmavať bez hlasovania; ak fandia jednému z tímov, môžu odovzdať jeden hlas na zápas. Nejde o predikčnú ani stávkovú appku — je to vizualizácia fanúšikovského sentimentu.

## Prečo práve toto (diferenciácia)
Kľúčový rozdiel oproti "zadarmo" alternatíve (IG/X anketa): mapa je **živá a rastúca**, nie jednorazový snímok.
- zdieľaný odkaz vždy ukazuje aktuálny stav (nie mŕtvy screenshot ankety)
- dáta sa časom kumulujú do klubového "globálneho fanúšikovského profilu" naprieč viacerými zápasmi — niečo, čo si jednorazová anketa nedokáže vybudovať
- to je zároveň aj obchodný moat: hodnota rastie s časom a objemom dát, nie je ju možné jednoducho skopírovať jedným postom

**Doplnené 2026-09-11 (pivot k B2B):** Skutočný moat nie je len "ľudia sa vracajú" (nepotvrdené), ale **dôveryhodnosť ako citovateľný zdroj dát** — analogicky k politickým prieskumným agentúram (YouGov, Ipsos), ktoré si rokmi budujú značku a metodiku, a potom ich médiá citujú pred veľkými udalosťami (voľby → tu: veľké finále). To je obranyschopnejšie než virálna appka, ale vyžaduje si to najprv nabudovať objem a metodickú dôveryhodnosť, viď business-case.md → B2B/médiá.

## Architektúra vs. obsah pri launchi (rieši rozsah pre sólo projekt)
Toto sú dve oddelené veci a netreba ich riešiť naraz:
- **Dátový model/architektúra**: navrhnutý od začiatku ako "sport-agnostic" (šport, liga, zápas, tím, hlas sú všeobecné entity) — takže pridanie NFL/NBA neskôr nebude vyžadovať prerábku, len pridanie dát. Toto vyrieši požiadavku "nechcem to musieť dorábať".
- **Obsah pri launchi**: napriek tomu odporúčam spustiť len s futbalom (najsilnejšie medzinárodné fanbase = najlepšie prvé mapy) a pridávať ďalšie športy podľa toho, koľko času sabbatical reálne dovolí. Menší launch obsah ≠ menšia architektúra.

## Integrita hlasovania (rieši dôveryhodnosť máp)
- 1 hlas na zápas na zariadenie/IP (základná ochrana pre MVP, nie dokonalá, ale štandardná a lacná)
- krajina sa vyfarbí až od minimálneho počtu hlasov (napr. 20+); pod prahom sa zobrazí ako "zatiaľ nedostatok dát" namiesto skresľujúcej 100% farby
- transparentnosť: pri každej krajine sa ukazuje aj počet hlasov, nie len percento — používateľ si vie sám vyhodnotiť dôveryhodnosť

**Doplnené 2026-09-11:** pre appku/zábavu (Fáza 1) stačí vyššie uvedené. Pre B2B/médiá použitie (Fáza 2, viď business-case.md) bude treba výrazne prísnejší prah a zdokumentovanú metodiku predtým, než sa akékoľvek číslo ponúkne novinárom — jedno vyvrátené/spochybnené číslo v éteri zničí dôveryhodnosť celého konceptu naraz.

## Studený štart (rieši prázdne mapy v deň 1)
Namiesto budovania automatického systému na odhad fanbase (zbytočná extra práca navyše) — manuálne naštartovať prvé 1–2 zápasy priamym zdieľaním do 2–3 relevantných komunít (futbalový subreddit, X vlákna) v deň launchu, aby prvé mapy mali reálne hlasy skôr, než ich niekto uvidí.

## Ochranné známky (POZOR – právne, nie je to právna rada)
Odporúčanie pre MVP: nepoužívať oficiálne logá/erby klubov (vyhnúť sa potrebe licencie) — stačí názov klubu + vlastná farba (tak či tak jadro dizajnu). Používanie samotných názvov klubov je vo všeobecnosti bezpečnejšie ako použitie log, ale pred akýmkoľvek plateným sponzoringom ("presented by X") je nutné poradiť sa so skutočným právnikom — toto by som nerobil na vlastnú päsť.

## Regionálna granularita – okresy/štáty v USA a EU (doplnené 2026-09-11)
Áno, dáva to zmysel ako rozšírenie — priamo to zapadá do "efekt ako pri voľbách" (presne takto vyzerajú americké voľby: mapa okres po okrese). Ale je v tom skrytá pasca, ktorú treba vyriešiť skôr, než sa do toho pustíme, nie po launchi:

**Presnosť geolokácie sa láme pri vyššom rozlíšení.** Na úrovni krajiny je IP geolokácia spoľahlivá (~99%). Na úrovni okresu/regiónu je IP geolokácia výrazne nepresná (chyba pokojne aj desiatky-stovky km, najmä mobil/VPN) — a keďže okres má oveľa menšiu vzorku hlasov než krajina, aj pár zle lokalizovaných hlasov dokáže "preklopiť" výsledok celého okresu. Presne to by zničilo dôveryhodnosť, o ktorú sa opierame pre B2B/médiá (viď business-case.md).
**Riešenie**: pri regionálnej úrovni prejsť z automatickej IP geolokácie na **vlastný výber regiónu pri hlasovaní** (dropdown/autocomplete štát+okres), nie spoliehať sa na IP. Menej pohodlné, ale oveľa dôveryhodnejšie.

**Toto je Fáza 2/3 funkcia, nie MVP.** Aby sa to však nemuselo neskôr prerábať:
- dátový model hlasu už teraz obsahuje voliteľné pole `region_code` (nepovinné, prázdne v MVP) vedľa `country_code` — pripravené na FIPS kódy (US štát+okres) a NUTS kódy (EU regióny), pridáme dáta bez zmeny štruktúry
- pre samotné mapy okresov/regiónov: hraničné dáta (TopoJSON) z US Census (okresy) a Eurostat (NUTS regióny), zjednodušené nástrojom ako mapshaper pre výkon — Mapbox GL JS toto bez problémov zvládne (WebGL), len treba správne pripravené súbory
- rozsah zámerne obmedzený na USA + EU (nie celý svet do detailu) — tam je najsilnejšie publikum aj najlepšie dostupné hraničné dáta

**Bonus pre B2B pitch**: toto je presne to, čo z produktu neskôr spraví silnejší "volebný" produkt pre médiá — swing-county štýl mapy je vizuálne veľmi príbuzný americkému volebnému spravodajstvu.

## Otvorené otázky
- ktoré konkrétne futbalové súťaže/zápasy spustiť ako prvé (rieši sa v business-case.md / pri pláne launchu)
- či a kedy pridať prihlásenie (email/social login) pre lepšiu ochranu proti duplicitným hlasom
- presný moment prechodu na regionálnu granularitu (Fáza 2 vs 3) — rozhodne sa podľa trakcie po launchi
- názov domény/appky (závisí od výsledku overenia globalfansmap.com / kolízie názvu, viď business-case.md)
