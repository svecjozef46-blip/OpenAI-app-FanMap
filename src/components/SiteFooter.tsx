import Link from "next/link";
import type { League } from "@/lib/types";
import { ThemeSelect } from "@/components/ThemeToggle";

// Links to OUR OWN social accounts ("follow us"). Each one appears only
// when its address is set in the environment (see .env.example), so the
// footer never shows a dead link before the accounts exist.
//
// This is separate from the share bar on the match map: Instagram and
// TikTok don't accept shared links from a web page, so they can't be share
// buttons — they're where our own clips get published.
const SOCIAL_LINKS = [
  { label: "Instagram", url: process.env.NEXT_PUBLIC_INSTAGRAM_URL },
  { label: "TikTok", url: process.env.NEXT_PUBLIC_TIKTOK_URL },
  { label: "YouTube", url: process.env.NEXT_PUBLIC_YOUTUBE_URL },
  { label: "X", url: process.env.NEXT_PUBLIC_X_URL },
].filter((link): link is { label: string; url: string } => !!link.url && link.url.startsWith("https://"));

// `leagues` is left out on static pages (the privacy pages), which then
// show no league links. `lang` = the language of the page the footer is on.
// `year` is passed by static pages, which may not read the clock while
// being prerendered.
export function SiteFooter({
  leagues,
  lang = "en",
  year,
}: {
  leagues?: League[];
  lang?: "en" | "sk";
  year?: number;
}) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-8">
          {leagues && (
            <nav aria-label="Leagues" className="flex flex-col gap-2.5">
              <span className="text-xs font-medium text-fg">Leagues</span>
              <ul className="flex max-w-md flex-wrap gap-x-5 gap-y-2">
                {leagues.map((league) => (
                  <li key={league.id}>
                    <Link href={`/league/${league.slug}`} className="text-muted hover:text-fg">
                      {league.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {SOCIAL_LINKS.length > 0 && (
            <nav aria-label="Follow Global Fan Map" className="flex flex-col gap-2.5">
              <span className="text-xs font-medium text-fg">Follow</span>
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {SOCIAL_LINKS.map((link) => (
                  <li key={link.label}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-fg">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-medium text-fg">Appearance</span>
            <ThemeSelect />
          </div>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-t border-line pt-6 text-xs text-muted">
          <p>
            © {year ?? new Date().getFullYear()} Global Fan Map. A fan-made project, not affiliated with any club or league. Team
            names and colors are used for identification only.
          </p>
          <Link href={lang === "sk" ? "/privacy/sk" : "/privacy"} className="shrink-0 hover:text-fg">
            {lang === "sk" ? "Ochrana súkromia" : "Privacy"}
          </Link>
        </div>
      </div>
    </footer>
  );
}
