// Facts the privacy pages (/privacy, /privacy/sk) are built from, kept in
// one place so the English and Slovak pages can't drift apart, and so the
// tests (tests/privacy.test.ts) can check them without rendering React.
// Overview for the owner: docs/privacy.md.

// Who runs the site. Set in Vercel (all three are public, they appear on the
// page). Until then the page says the details will be published before
// launch; scripts/check-privacy-config.mjs warns on production builds.
export type Operator = { name: string; address: string; email: string };

type Env = Record<string, string | undefined>;

// Pass the environment explicitly (tests), or leave it out: then the three
// NEXT_PUBLIC_ variables are read by name, which is what lets Next.js put
// their values into the page at build time.
export function getOperator(env?: Env): Operator | null {
  const name = (env ? env.NEXT_PUBLIC_OPERATOR_NAME : process.env.NEXT_PUBLIC_OPERATOR_NAME)?.trim();
  const address = (env ? env.NEXT_PUBLIC_OPERATOR_ADDRESS : process.env.NEXT_PUBLIC_OPERATOR_ADDRESS)?.trim();
  const email = (env ? env.NEXT_PUBLIC_CONTACT_EMAIL : process.env.NEXT_PUBLIC_CONTACT_EMAIL)?.trim();
  // All three or nothing: a page naming the operator without a way to
  // reach them (or the reverse) would be worse than the neutral text.
  if (!name || !address || !email) return null;
  // A plain address only, so the mailto: link can't be bent into something else.
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) return null;
  // "\n" in the variable = a new line in the address.
  return { name, address: address.replace(/\\n/g, "\n"), email };
}

export const OPERATOR_VARIABLES = ["NEXT_PUBLIC_OPERATOR_NAME", "NEXT_PUBLIC_OPERATOR_ADDRESS", "NEXT_PUBLIC_CONTACT_EMAIL"] as const;

// Shown on both pages; change it with every edit of their text.
export const LAST_UPDATED = "2026-11-26";

// Retention, as set in docs/migrations/2026-11-26-privacy-retention.sql
// (and register_vote_attempt()). The pages quote these numbers.
export const VOTER_ID_RETENTION_DAYS = 35;
export const ADDRESS_FINGERPRINT_RETENTION = "1 hour";
export const FEEDBACK_RETENTION_DAYS = 180;

// What the site keeps in the visitor's browser (localStorage). No cookies
// are set for visitors (only the admin sign-in in /admin uses cookies).
export const BROWSER_STORAGE = [
  { key: "fanmap_voter_seed", purpose: "voterKey" },
  { key: "fanmap_my_votes", purpose: "myVotes" },
  { key: "fanmap_theme", purpose: "theme" },
] as const;

export function formatDate(iso: string, lang: "en" | "sk"): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === "sk" ? "sk-SK" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
