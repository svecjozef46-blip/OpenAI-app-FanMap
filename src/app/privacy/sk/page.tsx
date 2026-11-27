import type { Metadata } from "next";
import { DataTable, OperatorDetails, PrivacyShell, Section } from "@/components/PrivacyPage";
import { MAP_ENGINE } from "@/lib/mapEngine";
import {
  ADDRESS_FINGERPRINT_RETENTION,
  FEEDBACK_RETENTION_DAYS,
  LAST_UPDATED,
  VOTER_ID_RETENTION_DAYS,
  formatDate,
} from "@/lib/privacy";

// Ochrana súkromia, slovenská verzia. Anglická (hlavná): app/privacy/page.tsx
// — obe držať v súlade. Fakty sú overené v kóde a databáze (docs/privacy.md);
// čo sa overiť nedalo, je označené REVIEW. Nejde o právne poradenstvo.

export const metadata: Metadata = {
  title: "Ochrana súkromia — Global Fan Map",
  description: "Čo Global Fan Map zaznamenáva pri hlasovaní, prečo, ako dlho a kto to vidí.",
  alternates: { languages: { en: "/privacy" } },
};

const ADDRESS_FINGERPRINT_SK = ADDRESS_FINGERPRINT_RETENTION === "1 hour" ? "hodinu" : ADDRESS_FINGERPRINT_RETENTION;

export default function PrivacyPageSk() {
  return (
    <PrivacyShell
      lang="sk"
      title="Ochrana súkromia"
      updated={`Posledná aktualizácia: ${formatDate(LAST_UPDATED, "sk")}`}
      otherLanguage={{ href: "/privacy", label: "English", lang: "en" }}
    >
      <Section id="short" title="V skratke">
        <ul className="list-disc space-y-2 pl-5">
          <li>Žiadne účty, žiadna reklama, žiadna analytika, žiadne sledovacie cookies.</li>
          <li>
            Keď hlasujete, zaznamenáme tím, zápas a vašu približnú krajinu a k tomu kód, ktorý bráni tomu, aby to
            isté zariadenie hlasovalo dvakrát. Po {VOTER_ID_RETENTION_DAYS} dňoch (keď je zápas uzavretý) sa tento
            kód nahradí náhodnou hodnotou; hlas ostáva vo výsledkoch.
          </li>
          <li>Na ochranu pred zneužitím uchovávame asi {ADDRESS_FINGERPRINT_SK} zakódovaný odtlačok vašej sieťovej adresy.</li>
          <li>Váš prehliadač si pamätá, ako ste hlasovali, a nastavenie svetlého/tmavého režimu. Môžete to kedykoľvek vymazať.</li>
          <li>Ostatní vidia vždy len súčty za krajiny.</li>
        </ul>
      </Section>

      <Section id="operator" title="Prevádzkovateľ a kontakt">
        <p>Stránku prevádzkuje:</p>
        <OperatorDetails lang="sk" />
      </Section>

      <Section id="data" title="Čo zaznamenávame a prečo">
        <DataTable
          head={["Čo", "Prečo", "Ako dlho", "Kto to vidí"]}
          rows={[
            [
              "Váš hlas: zápas, tím, čas",
              "Aby sme ukázali, ktorá krajina fandí ktorému tímu",
              `Ostáva súčasťou výsledkov. Po ${VOTER_ID_RETENTION_DAYS} dňoch už nie je spojený s kódom nižšie.`,
              "Všetci, ale len ako súčty za krajiny",
            ],
            [
              "Vaša približná krajina",
              "Náš hostingový poskytovateľ oznámi nášmu serveru, z ktorej krajiny požiadavka prichádza (podľa sieťovej adresy). Ukladáme len dvojpísmenový kód krajiny, nie adresu. Región ani mesto nezaznamenávame.",
              "Spolu s hlasom",
              "Všetci, len ako súčty",
            ],
            [
              "Kód hlasujúceho: kód vytvorený z náhodného kľúča vo vašom prehliadači, vašej sieťovej adresy a typu prehliadača, zakódovaný tak, aby sa nedal spätne rozlúštiť",
              "Aby to isté zariadenie nehlasovalo v jednom zápase dvakrát",
              `Po ${VOTER_ID_RETENTION_DAYS} dňoch od hlasu, keď je hlasovanie o zápase uzavreté, ho nahradí náhodná hodnota`,
              "Nikto: nikde sa nezobrazuje ani sa neposiela späť do prehliadača",
            ],
            [
              "Odtlačok vašej sieťovej adresy, zakódovaný spolu s tajomstvom, ktoré pozná len náš server",
              "Aby sme obmedzili, koľko hlasov a načítaní mapy pošle jedna sieť (ochrana pred robotmi)",
              `Asi ${ADDRESS_FINGERPRINT_SK}, potom sa automaticky vymaže`,
              "Nikto",
            ],
            [
              "Spätná väzba, ktorú nám pošlete (nepovinný e-mail a vaša správa)",
              "Aby sme ju prečítali a odpovedali. Formulár na spätnú väzbu na stránke zatiaľ nie je.",
              `${FEEDBACK_RETENTION_DAYS} dní`,
              "Prevádzkovateľ",
            ],
          ]}
        />
        <p>Nepýtame si vaše meno, e-mail ani účet a z údajov vyššie nevieme zistiť, kto ste.</p>
      </Section>

      <Section id="legal-basis" title="Právny základ">
        {/* REVIEW: právny základ zvolil majiteľ (čl. 6 ods. 1 písm. f GDPR); formuláciu a prípadný test proporcionality by mal potvrdiť právnik. */}
        <p>
          Tieto údaje spracúvame na základe nášho oprávneného záujmu (článok 6 ods. 1 písm. f GDPR): aby hlasovanie
          bolo férové (jeden hlas na zariadenie a zápas) a aby bola stránka chránená pred robotmi a zneužitím.
          Nepoužívame reklamu ani analytiku, preto nežiadame súhlas.
        </p>
      </Section>

      <Section id="device" title="Čo si uchováva váš prehliadač">
        <p>
          Stránka ukladá do lokálneho úložiska prehliadača tri malé záznamy (nie cookies). Nám sa posiela len
          náhodný kľúč, a to s každým hlasom, aby z neho vznikol kód hlasujúceho opísaný vyššie. Samotný kľúč
          u seba neukladáme.
        </p>
        <DataTable
          head={["Záznam", "Na čo slúži"]}
          rows={[
            ["fanmap_voter_seed", "Náhodný kľúč, aby jedno zariadenie bolo jeden hlasujúci"],
            ["fanmap_my_votes", "Za ktorý tím ste hlasovali v jednotlivých zápasoch, aby to stránka vedela ukázať"],
            ["fanmap_theme", "Vaša voľba svetlého/tmavého režimu, ak ste ju zmenili"],
          ]}
        />
        <p>
          Sú potrebné na to, aby stránka fungovala, ako je opísané, a nesledujú vás na iných weboch. Môžete ich
          vymazať v nastaveniach prehliadača (údaje stránky). Stránka potom už nebude vedieť ukázať, ako ste
          hlasovali.
        </p>
        <p>Návštevníkom nenastavujeme žiadne cookies. (Cookies používa len prihlásenie administrátorov stránky.)</p>
        {/* REVIEW: či Cloudflare Turnstile niečo ukladá v prehliadači, sa nepodarilo overiť (dokumentácia sa z pracovného prostredia nedala otvoriť). */}
      </Section>

      <Section id="map" title="Mapa">
        {MAP_ENGINE === "mapbox" ? (
          <>
            {/* REVIEW: úloha Mapboxu a mechanizmus prenosu neoverené v dokumentoch Mapboxu. */}
            <p>
              Mapu poskytuje spoločnosť Mapbox (USA). Pri načítaní mapy si váš prehliadač sťahuje mapové údaje od
              Mapboxu, ktorý tak dostane vašu sieťovú adresu a technické údaje o prehliadači, ako pri každej
              požiadavke na webovú stránku.
            </p>
          </>
        ) : (
          <p>
            Mapu kreslí váš prehliadač pomocou MapLibre, knižnice s otvoreným kódom. Tvary krajín, popisky aj písmo
            sa načítavajú z našej stránky; žiadny poskytovateľ máp nedostane od vášho prehliadača žiadnu požiadavku.
          </p>
        )}
      </Section>

      <Section id="processors" title="Kto nám pomáha stránku prevádzkovať">
        <DataTable
          head={["Poskytovateľ", "Na čo", "Kde"]}
          rows={[
            [
              "Vercel Inc.",
              "Hosting: doručuje stránku a spúšťa náš serverový kód. Ako každý hosting vidí pri načítaní stránky vašu sieťovú adresu a údaje o prehliadači a podľa vlastných pravidiel uchováva serverové záznamy (logy).",
              "Spojené štáty (náš serverový kód beží v regióne Vercelu iad1)",
            ],
            [
              "Supabase Inc.",
              "Databáza (hlasy, výsledky). Váš prehliadač z nej načítava aj výsledky zápasov priamo, takže aj ona vidí vašu sieťovú adresu.",
              "Európska únia (región Supabase eu-west-1)",
            ],
            [
              "Cloudflare, Inc. (Turnstile)",
              "Overenie, že hlasuje človek, nie robot. Spustí sa vo vašom prehliadači, keď otvoríte stránku, na ktorej sa dá hlasovať.",
              "Globálna sieť Cloudflare",
            ],
            ...(MAP_ENGINE === "mapbox" ? [["Mapbox, Inc.", "Mapové údaje", "Spojené štáty"]] : []),
          ]}
        />
        {/* REVIEW: doba uchovávania logov Vercelu neuvedená (neoverené). Regióny: iad1 z nastavení nasadenia, eu-west-1 zo Supabase projektu (overené 2026-11-26); odkiaľ Vercel doručuje statické stránky, overené nie je. */}
        {/* REVIEW: že Cloudflare je pri signáloch na detekciu robotov samostatným prevádzkovateľom, je zo zadania majiteľa („Turnstile Privacy Addendum“), neoverené — potvrdiť na https://www.cloudflare.com/turnstile-privacy-policy/ a doplniť odkaz; stránka sa z pracovného prostredia nedala otvoriť, preto odkaz nie je uvedený. */}
        {/* REVIEW: zásady ochrany súkromia / DPA Vercelu a Supabase — doplniť odkazy po overení (https://vercel.com/legal/privacy-policy, https://supabase.com/privacy). */}
        <p>
          O tom, ako Cloudflare používa signály zbierané na rozpoznanie robotov, rozhoduje Cloudflare sám; platia
          na to jeho vlastné podmienky ochrany súkromia pre Turnstile.
        </p>
      </Section>

      <Section id="transfers" title="Prenos mimo EÚ">
        {/* REVIEW: mechanizmus prenosu (EU-U.S. Data Privacy Framework alebo štandardné zmluvné doložky) sa nepodarilo overiť v dokumentoch poskytovateľov; doplniť pre každého poskytovateľa. */}
        <p>
          Niektorí z týchto poskytovateľov sídlia v Spojených štátoch (Vercel, Cloudflare
          {MAP_ENGINE === "mapbox" ? ", Mapbox" : ""}) a beží tam aj náš serverový kód, takže údaje sa môžu
          prenášať mimo Európskej únie. Podrobnosti o zárukách jednotlivých poskytovateľov sem doplníme.
        </p>
      </Section>

      <Section id="rights" title="Vaše práva">
        <p>
          Podľa GDPR môžete žiadať prístup k svojim údajom, ich opravu alebo vymazanie, obmedzenie spracúvania a
          prenosnosť a môžete namietať proti spracúvaniu na základe nášho oprávneného záujmu. Použite na to kontakt
          uvedený vyššie.
        </p>
        {/* REVIEW: odvolanie sa na článok 11 GDPR (bez povinnosti identifikovať) — potvrdiť s právnikom. */}
        <p>
          Neukladáme meno, e-mail ani účet, len zakódovaný kód hlasujúceho opísaný vyššie, ktorý s vami nevieme
          spojiť. Preto vaše údaje možno nebudeme vedieť nájsť a vybaviť žiadosť, ktorá to vyžaduje (článok 11
          GDPR), pokiaľ nám neposkytnete informácie, podľa ktorých ich nájdeme.
        </p>
        <p>
          Môžete sa tiež obrátiť so sťažnosťou na dozorný orgán, na Slovensku na Úrad na ochranu osobných údajov
          Slovenskej republiky, alebo na orgán v krajine, kde žijete.
        </p>
        {/* REVIEW: doplniť webovú stránku úradu po overení (https://dataprotection.gov.sk/ sa z pracovného prostredia nedala otvoriť). */}
      </Section>

      <Section id="changes" title="Zmeny týchto informácií">
        <p>
          Keď zmeníme, ako stránka narába s údajmi, aktualizujeme túto stránku aj dátum hore. Ak je zmena pre vás
          dôležitá (napríklad pribudne reklama), upozorníme na ňu na stránke.
        </p>
      </Section>
    </PrivacyShell>
  );
}
