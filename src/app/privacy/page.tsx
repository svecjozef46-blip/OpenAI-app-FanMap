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

// Privacy notice, English (the site's main language). Slovak version:
// app/privacy/sk/page.tsx — keep both in step. Facts are checked against
// the code and database (docs/privacy.md); anything that couldn't be
// checked is marked REVIEW for the owner. Not legal advice.

export const metadata: Metadata = {
  title: "Privacy — Global Fan Map",
  description: "What Global Fan Map records when you vote, why, for how long, and who sees it.",
  alternates: { languages: { sk: "/privacy/sk" } },
};

export default function PrivacyPage() {
  return (
    <PrivacyShell
      lang="en"
      title="Privacy"
      updated={`Last updated: ${formatDate(LAST_UPDATED, "en")}`}
      otherLanguage={{ href: "/privacy/sk", label: "Slovensky", lang: "sk" }}
    >
      <Section id="short" title="In short">
        <ul className="list-disc space-y-2 pl-5">
          <li>No accounts, no ads, no analytics, no tracking cookies.</li>
          <li>
            When you vote we record the team, the match and your approximate country, plus a code that stops the
            same device voting twice. After {VOTER_ID_RETENTION_DAYS} days (once the match is over) that code is
            replaced by a random value; the vote stays in the results.
          </li>
          <li>
            To stop abuse we keep a scrambled fingerprint of your network address for about {ADDRESS_FINGERPRINT_RETENTION}.
          </li>
          <li>Your browser remembers how you voted and your light/dark setting. You can clear this at any time.</li>
          <li>Everyone else only ever sees totals per country.</li>
        </ul>
      </Section>

      <Section id="operator" title="Operator and contact">
        <p>The site is run by:</p>
        <OperatorDetails lang="en" />
      </Section>

      <Section id="data" title="What we record and why">
        <DataTable
          head={["What", "Why", "How long", "Who sees it"]}
          rows={[
            [
              "Your vote: match, team, time",
              "To show which country supports which team",
              `Kept as part of the results. After ${VOTER_ID_RETENTION_DAYS} days it is no longer linked to the code below.`,
              "Everyone, but only as totals per country",
            ],
            [
              "Your approximate country",
              "Our host tells our server which country a request comes from (from the network address). We store only the two-letter country code, not the address. We don't record your region or city.",
              "With the vote",
              "Everyone, only as totals",
            ],
            [
              "A voter code: a code made from a random key created in your browser, your network address and your browser type, scrambled so it can't be turned back",
              "To stop the same device voting twice in one match",
              `Replaced by a random value ${VOTER_ID_RETENTION_DAYS} days after the vote, once voting on that match has closed`,
              "Nobody: it is never shown or sent back to your browser",
            ],
            [
              "A fingerprint of your network address, scrambled together with a secret only our server knows",
              "To limit how many votes and map loads one network can send (protection against bots)",
              `About ${ADDRESS_FINGERPRINT_RETENTION}, deleted automatically`,
              "Nobody",
            ],
            [
              "Feedback you send us (an optional e-mail address and your message)",
              "To read and answer it. There is no feedback form on the site yet.",
              `${FEEDBACK_RETENTION_DAYS} days`,
              "The operator",
            ],
          ]}
        />
        <p>
          We don&apos;t ask for your name, e-mail or any account, and we can&apos;t tell who you are from the data
          above.
        </p>
      </Section>

      <Section id="legal-basis" title="Legal basis">
        {/* REVIEW: legal basis chosen by the owner (Art. 6(1)(f) GDPR); a lawyer should confirm the wording and whether a balancing test needs to be documented. */}
        <p>
          We process this data on the basis of our legitimate interest (Article 6(1)(f) GDPR): keeping the vote fair
          (one vote per device per match) and protecting the site against bots and abuse. We don&apos;t use
          advertising or analytics, so we don&apos;t ask for consent.
        </p>
      </Section>

      <Section id="device" title="What your browser keeps">
        <p>
          The site stores three small entries in your browser&apos;s local storage (not cookies). Only the random
          key is ever sent to us: with each vote, to make the voter code above. The key itself is not stored on our
          side.
        </p>
        <DataTable
          head={["Entry", "What it is for"]}
          rows={[
            ["fanmap_voter_seed", "A random key, so one device counts as one voter"],
            ["fanmap_my_votes", "Which team you voted for in each match, so the page can show it"],
            ["fanmap_theme", "Your light/dark choice, if you made one"],
          ]}
        />
        <p>
          They are needed for the site to work as described and don&apos;t follow you on other websites. You can
          delete them in your browser&apos;s settings (site data for this site). The site will then no longer show
          how you voted.
        </p>
        <p>We set no cookies for visitors. (Only the sign-in for the site&apos;s administrators uses cookies.)</p>
        {/* REVIEW: whether Cloudflare Turnstile stores anything in the browser was not verified (their documentation couldn't be opened from the work environment). */}
      </Section>

      <Section id="map" title="The map">
        {MAP_ENGINE === "mapbox" ? (
          <>
            {/* REVIEW: Mapbox's role and transfer mechanism not verified against Mapbox's own documents. */}
            <p>
              The map is provided by Mapbox (USA). When the map loads, your browser fetches map data from Mapbox,
              which receives your network address and technical details about your browser, as with any website
              request.
            </p>
          </>
        ) : (
          <p>
            The map is drawn in your browser with MapLibre, an open-source library. Its country shapes, labels and
            font come from our own site; no map provider receives any request from your browser.
          </p>
        )}
      </Section>

      <Section id="processors" title="Who helps us run the site">
        <DataTable
          head={["Provider", "What for", "Where"]}
          rows={[
            [
              "Vercel Inc.",
              "Hosting: delivers the site and runs our server code. Like any web host it sees your network address and browser details when you load a page, and keeps server logs under its own rules.",
              "United States (our server code runs in Vercel region iad1)",
            ],
            [
              "Supabase Inc.",
              "Database (votes, results). Your browser also loads the match results from it directly, so it sees your network address too.",
              "European Union (Supabase region eu-west-1)",
            ],
            [
              "Cloudflare, Inc. (Turnstile)",
              "A check that a person, not a bot, is voting. It runs in your browser when you open a page where you can vote.",
              "Cloudflare's global network",
            ],
            ...(MAP_ENGINE === "mapbox" ? [["Mapbox, Inc.", "Map data", "United States"]] : []),
          ]}
        />
        {/* REVIEW: Vercel log retention period not stated (not verified). Regions: iad1 from the deployment settings, eu-west-1 from the Supabase project (both checked 2026-11-26); where Vercel serves static pages from was not verified. */}
        {/* REVIEW: Cloudflare as an independent controller for the bot-detection signals is taken from the owner's brief ("Turnstile Privacy Addendum"), not verified — confirm on https://www.cloudflare.com/turnstile-privacy-policy/ and add a link; the page couldn't be opened from the work environment, so no link is shown. */}
        {/* REVIEW: Vercel and Supabase privacy policies / DPAs — add links once checked (https://vercel.com/legal/privacy-policy, https://supabase.com/privacy). */}
        <p>
          Cloudflare decides itself how it uses the signals it collects to detect bots; its own privacy terms for
          Turnstile apply to that.
        </p>
      </Section>

      <Section id="transfers" title="Transfers outside the EU">
        {/* REVIEW: the transfer mechanism (EU-U.S. Data Privacy Framework or Standard Contractual Clauses) could not be verified from the providers' own documents; fill in per provider. */}
        <p>
          Some of these providers are based in the United States (Vercel, Cloudflare
          {MAP_ENGINE === "mapbox" ? ", Mapbox" : ""}), and our server code runs there, so data can be transferred
          outside the European Union. Details of the safeguards each provider uses will be added here.
        </p>
      </Section>

      <Section id="rights" title="Your rights">
        <p>
          Under the GDPR you can ask for access to your data, its correction or deletion, a restriction of its use,
          and data portability, and you can object to processing based on our legitimate interest. To do so, use
          the contact above.
        </p>
        {/* REVIEW: reliance on Article 11 GDPR (no obligation to identify) — confirm with a lawyer. */}
        <p>
          We store no name, e-mail address or account, only the scrambled voter code described above, which we
          can&apos;t link to you. We may therefore be unable to find your data and act on a request that needs it
          (Article 11 GDPR), unless you give us information that lets us find it.
        </p>
        <p>
          You can also complain to a data protection authority, in Slovakia the Úrad na ochranu osobných údajov
          Slovenskej republiky (Office for Personal Data Protection of the Slovak Republic), or the authority where
          you live.
        </p>
        {/* REVIEW: add the authority's website once checked (https://dataprotection.gov.sk/ couldn't be opened from the work environment). */}
      </Section>

      <Section id="changes" title="Changes to this notice">
        <p>
          When we change how the site handles data, we update this page and the date at the top. If the change
          matters for you (for example, if advertising is added), we will say so on the site.
        </p>
      </Section>
    </PrivacyShell>
  );
}
