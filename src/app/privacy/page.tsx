import type { Metadata } from "next";
import { getActiveLeagues } from "@/lib/queries";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy — Global Fan Map",
  description: "What Global Fan Map stores when you vote, and what it does not.",
};

// Like the home page, this is rendered per request so the league tabs and
// footer links always match the database (see the note in app/page.tsx).
export const instant = false;

// Plain-English privacy notice. Keep it in sync with the code: browser
// storage keys live in lib/voter.ts and lib/theme.ts, the IP / country
// handling in app/api/votes/route.ts, the human check in lib/turnstile.ts.
export default async function PrivacyPage() {
  const leagues = await getActiveLeagues();

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="sticky top-0 z-30">
        <SiteNav leagues={leagues} active="privacy" />
      </div>

      <main className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
        <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] uppercase leading-none tracking-[-0.01em]">
          Privacy
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Global Fan Map shows which countries support which team. You don&apos;t need an account, and we never ask
          for your name or e-mail to vote. Here is exactly what is stored and why.
        </p>

        <Section title="On your device">
          <p>
            Your browser keeps three small items in its local storage. They stay on your device and are not
            tracking cookies.
          </p>
          <ul>
            <li>
              <Code>fanmap_voter_seed</Code> — a random anonymous ID created for your device the first time you vote.
              It is not linked to your name or any account. It helps us recognise a repeat vote from the same device.
            </li>
            <li>
              <Code>fanmap_my_votes</Code> — which team you chose in which match, so the page can show your choice
              again after a reload.
            </li>
            <li>
              <Code>fanmap_theme</Code> — your light or dark mode choice, if you made one.
            </li>
          </ul>
          <p>Clearing your browser data removes all three.</p>
        </Section>

        <Section title="When you vote">
          <ul>
            <li>
              <strong>Country.</strong> We work out your country from your IP address on our server. Only the
              country code is saved with your vote — not your IP address, and not a more precise location.
            </li>
            <li>
              <strong>IP address.</strong> We do not store it. It is used only as a one-way hash (a scrambled
              fingerprint that can&apos;t be turned back into the address) for rate limiting and for preventing
              duplicate votes.
            </li>
            <li>
              <strong>Aggregated results.</strong> A vote is stored as: match, team, country and an anonymous
              hash. The map and the percentages show only totals per country — never individual votes.
            </li>
          </ul>
        </Section>

        <Section title="Bot protection">
          <p>
            To keep out automated votes we use Cloudflare Turnstile. It runs quietly in the background when you open
            the site and only asks for a click if it is unsure. Cloudflare receives technical information from your
            browser to do this, under its own privacy policy.
          </p>
        </Section>

        <Section title="What we don't do">
          <p>
            We don&apos;t sell data, show ads or build profiles of visitors. This notice sets out what we collect
            now; if that changes, this page will change first.
          </p>
        </Section>

        <Section title="Contact">
          <p>Questions about privacy? Write to [CONTACT_EMAIL].</p>
        </Section>
      </main>

      <SiteFooter leagues={leagues} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 space-y-3 leading-relaxed text-muted [&_li]:mt-2 [&_strong]:text-fg [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <h2 className="text-xl font-semibold tracking-tight text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-fg/10 px-1.5 py-0.5 font-mono text-[0.85em] text-fg">{children}</code>;
}
