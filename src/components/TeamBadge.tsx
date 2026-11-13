import type { Team } from "@/lib/types";

// Teams have no official crest (logo_url) by design — see docs/idea.md
// "trademark caution". This is the one place that fallback lives: a
// colored initials badge, so the rest of the app never has to think about
// the "logo missing" case.
export function TeamBadge({ team, size = 32 }: { team: Team; size?: number }) {
  if (team.logo_url) {
    // External, unpredictable source dimensions; next/image isn't worth
    // the setup for a path we don't currently use (see note above).
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logo_url}
        alt={team.name}
        width={size}
        height={size}
        className="rounded-full object-cover"
      />
    );
  }

  const initials = team.short_name || team.name.slice(0, 3).toUpperCase();
  // Dark initials on light team colors (e.g. Real Madrid white, Dortmund
  // yellow) — white text would disappear there.
  const n = parseInt(team.primary_color.slice(1), 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  const textColor = luminance > 0.6 ? "#18181b" : "#ffffff";

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        backgroundColor: team.primary_color,
        color: textColor,
        border: `2px solid ${team.secondary_color}`,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
