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

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        backgroundColor: team.primary_color,
        border: `2px solid ${team.secondary_color}`,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
