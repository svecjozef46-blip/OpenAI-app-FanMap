# FanMap – Business Case (v2, revidované)

_Posledná revízia: 2026-09-26 — nahrádza pôvodný ChatGPT draft (viď idea-original-chatgpt.md)_

## Cieľ a stratégia
Nejde o plán budovať a prevádzkovať toto sólo navždy. Cieľ: postupne vybudovať dostatočnú trakciu/dôkaz záujmu, a potom buď prizvať technologického partnera, alebo projekt predať — nie dotiahnuť všetko na 100% sám. Toto je dôležité kritérium pre rozhodnutia nižšie (stack, dokumentácia, vlastníctvo) — optimalizujeme pre "dá sa to ukázať a odovzdať/predať", nie pre dokonalosť.

Dôsledky:
- **Stack** (rieši sa v tech-stack.md) by mal byť mainstreamový a bežne známy — budúci technický partner alebo kupec sa v ňom musí vedieť rýchlo zorientovať.
- **Dokumentácia** (presne to, čo robíme v docs/) je reálne aktívum, nielen poriadok — funguje ako "data room" pre partnera/kupca.
- **Čistota vlastníctva**: doména, repozitár, prípadne ochranná známka/názov by mali patriť jednoznačne tebe.
- **Najcennejšie aktívum na predaj/partnerstvo nie je technická dokonalosť, ale dôkaz trakcie** — reálne hlasy, aspoň jeden virálny moment, prípadne prvý B2B kontakt.

Poznámka k "nikdy to nebude 100% presné": to nie je problém, to je očakávaný stav — práve preto máme prah dôveryhodnosti a transparentnosť namiesto tvrdenia o dokonalosti (viď idea.md).

## Trh a konkurencia
_Po prieskume — pôvodné tvrdenie "žiadna priama konkurencia" bolo nesprávne, opravené:_

Vizuálny koncept ("mapa sveta = kto koho podporuje") už bol viackrát urobený ako jednorazový content (Premier League Twitter follower map, "The Global Map of Football Fandom" na Google Maps Mania, NFL/College Football fan mapy na Tableau) — dokazuje to, že publikum o tento formát má záujem, ale zároveň to znamená, že "mapa podpory" sama o sebe nie je unikátna.

Priamejšia konkurencia/prekryv:
- **WorldFanatic** (worldfanatic.com/fan-map) — "coming soon" produkt s takmer identickým pitchom, iný mechanizmus (fanúšikovské profily/cestovanie, nie hlasovanie zápas-po-zápase). Treba sledovať.
- **Global Fans Map** (globalfansmap.com) — názvovo veľmi blízko, spomína "$5 to grow your team on the world map". Obsah stránky sa nepodarilo automaticky stiahnuť — **odporúčam si to prejsť osobne v prehliadači**.
- Názov "FanMap" už používa nesúvisiaca appka pre fanúšikov klubu Brøndby IF — nie funkčný konkurent, ale kolízia názvu.

Nepriama konkurencia: jednorazové ankety na IG/X/Reddit dosahujú rovnaké rozšírenie zadarmo bez appky.

Záver: nie je to prázdny trh, ale ani jasná dominancia niekoho iného — priestor je otvorený, ak sa "živá/rastúca/hlasovacia" mechanika reálne ukáže ako dôvod vracať sa.

## Monetizácia
**Primárny plán: predaj dát/insightov, nie appka s reklamou.**
- **Médiá (TV, redakcie)**: pred veľkými zápasmi (finále FIFA, Champions League) ponúknuť "komu fandí svet" ako hotový grafický/dátový podklad — presne ako "volebná noc" grafika. Analógia: politické prieskumné agentúry (YouGov, Ipsos).
- **Agentúry a kluby (neskôr)**: shifty počas zápasu (live) aj dlhodobé regionálne zmeny. Toto je hlavný biznis, nie voliteľný bonus.

**Dôsledok pre poradie práce:** predaj dát médiám stojí a padá na **dôveryhodnosti vzorky** — to sprísňuje požiadavky z idea.md (minimálny prah hlasov na krajinu).

**Fázovanie:**
1. **Fáza 1 – appka (MVP)**: futbal, hlasovanie, mapa. Cieľ: nabudovať objem hlasov a overiť dôveryhodnosť mechaniky.
2. **Fáza 2 – prvý B2B pokus**: keď je objem dostatočný pred veľkým zápasom, pripraviť "press kit" a osloviť pár športových redakcií — predajná/PR aktivita, nie technická úloha.
3. **Fáza 3 – live shifty a dlhodobé trendy pre agentúry/kluby**: až keď existuje história dát a aspoň jeden úspešný B2B kontakt.

Reklama v appke a sponzoring ("presented by X") ostávajú doplnkový, nie primárny zdroj príjmu — sponzoring je viazaný na vyriešenie ochranných známok (viď idea.md).

**Prečo nie App Store**
Zvažovaná otázka: ísť cez App Store, kde by platby šli cez Apple. Zamietnuté, z troch dôvodov:
1. **Platby cez App Store riešia iný problém.** Apple In-App Purchase je pre spotrebiteľské platby vnútri appky — nie pre B2B predaj dát médiám/agentúram, čo je náš primárny plán. Kontrakt s TV stanicou sa fakturuje priamo. Navyše Apple si berie 15–30% z IAP.
2. **Friction zabíja virálny mechanizmus.** Zdieľaný odkaz musí ísť otvoriť jedným klikom v prehliadači — povinná inštalácia appky by stratila drvivú väčšinu tohto trafficu ešte pred prvým pozretím mapy.
3. **Natívna appka + App Store review = výrazne väčší rozsah práce** pre sólo nedevelopera.

Kompromis: appka ako **PWA** ("Pridať na plochu") — app-like pocit bez App Store trenia, bez Apple provízie, bez straty jedno-klikového zdieľania. Next.js to podporuje s minimálnym úsilím. Natívnu appku prehodnotiť neskôr, ak pribudne konkrétny dôvod (napr. push notifikácie).

## Náklady a zdroje
Sólo projekt počas sabbaticalu (nie developer, nie PM) — najväčším nákladom je čas, nie peniaze. MVP obsah = len futbal, dátová architektúra pripravená na ďalšie športy bez prerábky. Prvé zápasy naštartované manuálne (vlastným zdieľaním do komunít).

## Riziká
- integrita hlasovania (riešené v idea.md – prah na vyfarbenie + limit 1 hlas/zariadenie; pre B2B prísnejšie)
- studený štart (riešené v idea.md – manuálny seeding prvých zápasov)
- právne riziko okolo log/ochranných známok pri budúcom sponzoringu (konzultácia s právnikom pred monetizáciou)
- rozsah/čas: aj so sabbaticalom je toto sólo projekt — najväčšie riziko je pokus urobiť príliš veľa naraz
- **timing pre B2B**: dôveryhodný objem dát treba mať nabudovaný *pred* prvou veľkou udalosťou, nie tesne pred ňou
- **BD/predajná zručnosť**: osloviť a presvedčiť TV/redakcie je iná zručnosť než postaviť appku — samostatná úloha
