# Ochrana súkromia: prehľad pre majiteľa

Stručné zhrnutie, čo appka spracúva, prečo a ako dlho, čo treba doplniť pred spustením a čo ostáva otvorené. Texty pre návštevníkov sú na `/privacy` (anglicky) a `/privacy/sk` (slovensky); zdrojové fakty sú v `src/lib/privacy.ts`. **Nie je to právne poradenstvo**: miesta, ktoré sa nedali overiť, sú v kóde stránok označené `REVIEW` (zoznam nižšie). Stav k 2026-11-26.

## Údaje: účel, základ, doba, kto ich vidí

| Údaj | Kde | Účel | Právny základ | Doba | Kto ho vidí |
|---|---|---|---|---|---|
| Hlas: zápas, tím, čas | `votes` | výsledky „ktorá krajina komu fandí“ | oprávnený záujem (čl. 6 ods. 1 písm. f) | trvale ako súčasť výsledkov (po 35 dňoch už bez väzby na `voter_hash`) | verejnosť len ako súčty (`match_results`) |
| Krajina (2 písmená) | `votes.country_code` | výsledky podľa krajín | oprávnený záujem | spolu s hlasom | verejnosť len ako súčty |
| Región | `votes.region_code` | — | — | stĺpec existuje, ale nikdy sa nevypĺňa (`submit_vote()` ho nezapisuje) | — |
| Identifikátor hlasujúceho `voter_hash` = sha256(kľúč zariadenia : IP : user-agent) | `votes.voter_hash` | jeden hlas na zariadenie a zápas | oprávnený záujem | **35 dní** po hlase, ak je zápas uzavretý, potom náhodná hodnota (`anonymize_old_votes()`) | nikto (API ho nevracia) |
| Odtlačok IP (sha256 so serverovým tajomstvom), rozsah hlasy aj `map:` | `vote_attempts.ip_hash` | limit pokusov (ochrana pred robotmi) | oprávnený záujem | **1 hodina** (`purge-vote-attempts` každých 15 min, teda najviac ~1 h 15 min) | nikto |
| Spätná väzba: typ, nepovinný e-mail, správa | `feedback` | odpovedať na správy (formulár zatiaľ nie je) | oprávnený záujem | **180 dní** (`purge-old-feedback`) | prevádzkovateľ (admin) |
| `fanmap_voter_seed`, `fanmap_my_votes`, `fanmap_theme` | localStorage v prehliadači | kľúč zariadenia, pamätanie hlasu, téma | nevyhnutné pre fungovanie | kým ich návštevník nevymaže | len zariadenie (kľúč sa posiela pri hlase serveru, ktorý ho hashuje a neukladá) |
| IP, prehliadač, URL v serverových logoch | Vercel | hosting | oprávnený záujem | podľa pravidiel Vercelu (**neoverené**) | Vercel |
| IP a signály prehliadača pri overení Turnstile | Cloudflare | ochrana pred robotmi | oprávnený záujem; Cloudflare podľa zadania samostatný prevádzkovateľ (**neoverené**) | podľa Cloudflare | Cloudflare |
| IP pri čítaní výsledkov priamo z prehliadača | Supabase (región `eu-west-1`) | databáza | oprávnený záujem | podľa Supabase | Supabase |
| IP a údaje prehliadača pri načítaní mapy | Mapbox (USA) | len pri `NEXT_PUBLIC_MAP_ENGINE=mapbox` | oprávnený záujem | podľa Mapboxu | Mapbox |

Administrátori (`admin_users`, Supabase Auth) sú len prevádzkovatelia, nie návštevníci; ich prihlásenie je jediné miesto, kde web nastavuje cookies. Analytika, reklama ani skripty tretích strán okrem Turnstile v appke nie sú (overené v `package.json` a `src/app/layout.tsx`). Písma (`next/font`) sú súčasťou buildu, nesťahujú sa z Googlu.

**Kam sa pripája prehliadač** (úvodná stránka a `/privacy` overené na lokálnom produkčnom builde, stránka zápasu aj na preview a produkcii): úvodná stránka a `/privacy` nerobia žiadnu požiadavku mimo našej domény. Stránka zápasu volá Supabase (výsledky) a Cloudflare (Turnstile, len kde sa hlasuje). Pri MapLibre nejde nič k poskytovateľovi máp, pri Mapboxe `api.mapbox.com` a `events.mapbox.com`.

## Premenné prostredia (pred spustením doplniť)

| Premenná | Príklad formátu | Kde sa ukáže |
|---|---|---|
| `NEXT_PUBLIC_OPERATOR_NAME` | meno alebo názov firmy | „Operator and contact“ |
| `NEXT_PUBLIC_OPERATOR_ADDRESS` | ulica a číslo`\n`PSČ mesto`\n`krajina | pod menom; `\n` = nový riadok |
| `NEXT_PUBLIC_CONTACT_EMAIL` | adresa na žiadosti o súkromie | ako `mailto:` odkaz |

- Nastaviť **všetky tri** (inak stránka ukáže neutrálny text „Contact details will be published here before launch.“). Vercel → Settings → Environment Variables → Production (a Preview, ak chceš vidieť náhľad) → Redeploy.
- Kým chýbajú, každý produkčný build na Verceli vypíše výrazné varovanie (`scripts/check-privacy-config.mjs`, spúšťa ho `npm run build`); build nezlyhá. V `npm run dev` je na stránke viditeľná výstraha.

## Ako aplikovať migráciu uchovávania (urobí majiteľ)

1. Prečítaj `docs/migrations/2026-11-26-privacy-retention.sql` (komentáre vysvetľujú každé pravidlo).
2. Supabase → projekt FanMap → **SQL Editor** → vlož celý súbor → **Run**. Dá sa spustiť aj opakovane.
3. Kontrola: `select jobname, schedule, command from cron.job order by jobname;` má vypísať `anonymize-old-votes`, `purge-old-feedback`, `purge-vote-attempts` a `rotate-matches`.
4. Voliteľne hneď: `select public.anonymize_old_votes();` (vráti počet zmenených hlasov; dnes 0, najstarší hlas je z 26. 11. 2026).
5. Späť (ak treba): `select cron.unschedule('anonymize-old-votes'); select cron.unschedule('purge-vote-attempts'); select cron.unschedule('purge-old-feedback'); drop function public.anonymize_old_votes();` Anonymizované hlasy sa vrátiť nedajú, výsledky sa tým však nemenia.

Migrácia je otestovaná na lokálnom Postgres (PGlite) so skutočnými definíciami tabuliek: `docs/migrations/2026-11-26-privacy-retention.test.mjs`, 15/15 kontrol (súčty a `match_results` sú pred aj po rovnaké, nové hlasy a hlasy na ešte neodohraný zápas ostávajú, druhé spustenie nič nemení, práva aj plánované úlohy sedia). Vetvu Supabase som nepoužil, lebo je to účtovaná služba.

## Prečo tieto lehoty

- **35 dní pre `voter_hash`:** identifikátor slúži len na to, aby to isté zariadenie nehlasovalo v zápase dvakrát. Po uzavretí zápasu už nemá úlohu. Zápas sa uzavrie najneskôr pár dní po svojom týždni (`rotate_matches()`), takže ostáva asi mesiac na preverenie zneužitia (napr. dávka hlasov z jednej siete). Anonymizujú sa len hlasy **uzavretých** zápasov: `submit_vote()` na uzavretý zápas hlas neprijme, takže anonymizácia neumožní hlasovať znova.
- **1 hodina pre odtlačky IP:** najdlhšie okno limitu je hodina, staršie záznamy nemajú účel.
- **180 dní pre spätnú väzbu:** dosť na prečítanie a odpoveď, nie dlhšie.

## Keď pribudne reklama alebo analytika

Potom už nestačí oprávnený záujem: na reklamné/analytické cookies a podobné technológie bude treba **súhlas** návštevníka a lištu s výberom. Treba nasadiť overenú platformu na správu súhlasu (CMP) a doplniť túto stránku a texty `/privacy`. **Teraz sa nepridáva nič.**

Zo zadania (neoverené, stránku Vercelu sa z pracovného prostredia nepodarilo otvoriť): plán Vercel **Hobby je len na nekomerčné použitie** a **Vercel DPA platí pre plány Pro a Enterprise**. Pred prvými reklamami (komerčné použitie) teda treba prejsť na **Vercel Pro**.

## Otvorené otázky a REVIEW

V kóde stránok `src/app/privacy/page.tsx` a `src/app/privacy/sk/page.tsx` sú tieto miesta označené `REVIEW`:

1. **Právny základ** (čl. 6 ods. 1 písm. f): zvolil majiteľ; formuláciu a prípadný zdokumentovaný test proporcionality potvrdí právnik.
2. **Turnstile v prehliadači:** či Cloudflare Turnstile niečo ukladá v prehliadači, sa nepodarilo overiť.
3. **Mapbox** (len pri `mapbox` engine): rola a mechanizmus prenosu neoverené v dokumentoch Mapboxu.
4. **Logy Vercelu:** doba uchovávania neuvedená. Odkiaľ Vercel doručuje statické stránky, neoverené. Regióny `iad1` (serverový kód Vercelu, USA) a `eu-west-1` (Supabase) sú overené z nastavení.
5. **Cloudflare ako samostatný prevádzkovateľ** pri signáloch na detekciu robotov: preberá zadanie, neoverené. Odkaz na „Turnstile Privacy Addendum“ nie je uvedený.
6. **Odkazy na zásady/DPA Vercelu a Supabase:** zatiaľ bez odkazov.
7. **Prenosy mimo EÚ:** mechanizmus (EU-U.S. Data Privacy Framework alebo štandardné zmluvné doložky) pre Vercel, Cloudflare (a Mapbox) doplniť z ich dokumentov.
8. **Článok 11 GDPR** (žiadosti, ktoré vyžadujú identifikáciu): potvrdiť s právnikom.
9. **Web Úradu na ochranu osobných údajov SR:** zatiaľ bez odkazu.

**Prečo nie sú externé odkazy:** zadanie vyžaduje každý odkaz pred použitím načítať a overiť. Z pracovného prostredia sa ani po povolení domén nepodarilo otvoriť žiadnu z adries (www.cloudflare.com, vercel.com, supabase.com, www.mapbox.com, dataprotection.gov.sk, eur-lex.europa.eu, www.dataprivacyframework.gov). Navrhované adresy sú v `REVIEW` komentároch; po overení ich stačí doplniť ako odkazy.

Ďalšie otázky pre majiteľa:
- **Hlasy na zápasy ďaleko vopred:** hlas odovzdaný napr. 40 dní pred výkopom sa anonymizuje až po uzavretí zápasu (tak je to správne). Ak by admin v `/admin` vrátil uzavretý zápas späť na `upcoming`/`live`, zariadenia s anonymizovaným hlasom by mohli hlasovať znova. Odporúčanie: uzavreté zápasy neotvárať.
- **Doba uchovávania samotných hlasov** (bez identifikátora) nie je obmedzená; sú to anonymné štatistiky. Ak ich chceš mazať (napr. po sezóne), treba rozhodnúť.
- **Tabuľka `feedback`** prijíma zápisy verejným kľúčom (politika „public can submit feedback“), hoci appka nemá formulár. Ak sa formulár neplánuje, politiku možno zrušiť.
