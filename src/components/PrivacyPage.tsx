import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { LAST_UPDATED, getOperator } from "@/lib/privacy";

// Shared frame of the privacy pages (/privacy in English, /privacy/sk in
// Slovak): a readable column of text in the site's light/dark colors, a
// link to the other language, and the site footer. The text itself lives
// in app/privacy/page.tsx and app/privacy/sk/page.tsx.

export function PrivacyShell({
  lang,
  title,
  updated,
  otherLanguage,
  children,
}: {
  lang: "en" | "sk";
  title: string;
  updated: string;
  otherLanguage: { href: string; label: string; lang: "en" | "sk" };
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 text-sm">
          <Link href="/" className="font-medium text-fg hover:text-accent">
            ← Global Fan Map
          </Link>
          <Link href={otherLanguage.href} hrefLang={otherLanguage.lang} lang={otherLanguage.lang} className="text-muted hover:text-fg">
            {otherLanguage.label}
          </Link>
        </div>
      </header>
      <main lang={lang} className="mx-auto max-w-3xl px-5 py-10 md:py-14">
        <h1 className="font-display text-[clamp(1.8rem,5vw,2.75rem)] uppercase leading-none">{title}</h1>
        <p className="mt-3 text-sm text-muted">{updated}</p>
        <div className="privacy-text mt-10">{children}</div>
      </main>
      <SiteFooter lang={lang} year={Number(LAST_UPDATED.slice(0, 4))} />
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 first:mt-0">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4 leading-relaxed text-fg/90">{children}</div>
    </section>
  );
}

// A table that stays readable on a phone: rows become stacked cards.
export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="hidden bg-fg/[0.04] md:table-header-group">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="block border-t border-line first:border-t-0 md:table-row md:first:border-t">
              {row.map((cell, j) => (
                <td key={j} className="block px-4 py-1.5 align-top first:pt-3 last:pb-3 md:table-cell md:py-3">
                  <span className="mb-0.5 block text-xs text-muted md:hidden">{head[j]}</span>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// "Operator and contact". Shows the three NEXT_PUBLIC_OPERATOR_* /
// NEXT_PUBLIC_CONTACT_EMAIL values when all are set; otherwise a neutral
// sentence (never invented details) and, in development only, a visible
// reminder to set them.
export function OperatorDetails({ lang }: { lang: "en" | "sk" }) {
  const operator = getOperator();
  if (!operator) {
    return (
      <>
        <p>
          {lang === "sk"
            ? "Kontaktné údaje prevádzkovateľa tu zverejníme pred spustením stránky."
            : "Contact details will be published here before launch."}
        </p>
        {process.env.NODE_ENV !== "production" && (
          <p role="note" className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
            Development note: set NEXT_PUBLIC_OPERATOR_NAME, NEXT_PUBLIC_OPERATOR_ADDRESS and NEXT_PUBLIC_CONTACT_EMAIL
            (see .env.example and docs/privacy.md) before the site goes live.
          </p>
        )}
      </>
    );
  }
  return (
    <address className="not-italic">
      <span className="block font-medium">{operator.name}</span>
      <span className="block whitespace-pre-line">{operator.address}</span>
      <a href={`mailto:${operator.email}`} className="mt-1 inline-block text-accent underline underline-offset-2">
        {operator.email}
      </a>
    </address>
  );
}
