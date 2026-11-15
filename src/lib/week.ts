// The "match week" — the one place in the app that defines it.
//
// A week runs from Monday 00:00 to the next Monday 00:00 in Bratislava time
// (Europe/Bratislava, i.e. CET in winter and CEST in summer). Lists on the
// site show only the current week's matches; a match from an earlier week
// is reachable only through its direct link (docs/decisions-log.md,
// 2026-11-15).
//
// The database uses the same definition in public.week_start()
// (docs/schema.sql), which archives old matches. tests/week.test.ts checks
// that both give the same answer, including around the switches to and
// from summer time.
//
// Uses the built-in Intl time-zone support (no date library), so summer
// time is handled by the same rules the browser and Node already use.

export const WEEK_TIME_ZONE = "Europe/Bratislava";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: WEEK_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: WEEK_TIME_ZONE,
  timeZoneName: "longOffset",
});

// Calendar date and weekday of an instant, as seen in Bratislava.
function localDate(instant: Date): { year: number; month: number; day: number; weekdayIndex: number } {
  const parts = Object.fromEntries(partsFormatter.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekdayIndex: WEEKDAYS.indexOf(parts.weekday), // Monday = 0
  };
}

// Bratislava's offset from UTC at an instant, in minutes (+60 or +120).
function offsetMinutes(instant: Date): number {
  const name = offsetFormatter.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0; // "GMT" alone means +00:00
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

// The instant when a Bratislava calendar day starts (00:00 local time).
// Midnight is never skipped or repeated by a clock change here (those
// happen at 02:00/03:00), so this always has exactly one answer.
function startOfLocalDay(year: number, month: number, day: number): Date {
  const asIfUtc = Date.UTC(year, month - 1, day);
  // First guess with the offset at that moment, then correct once in case
  // the guess landed on the other side of a clock change.
  const guess = asIfUtc - offsetMinutes(new Date(asIfUtc)) * 60_000;
  return new Date(asIfUtc - offsetMinutes(new Date(guess)) * 60_000);
}

// Monday 00:00 (Bratislava) of the week that contains `instant`.
export function weekStart(instant: Date): Date {
  const { year, month, day, weekdayIndex } = localDate(instant);
  // Calendar arithmetic on a plain date (UTC noon avoids any edge issues).
  const monday = new Date(Date.UTC(year, month - 1, day, 12) - weekdayIndex * DAY_MS);
  return startOfLocalDay(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

// [start, end) of the week that contains `instant`: Monday 00:00 up to,
// but not including, the next Monday 00:00. Not always 7 × 24 hours — the
// weeks with a clock change are an hour shorter or longer.
export function weekRange(instant: Date): { start: Date; end: Date } {
  const start = weekStart(instant);
  // Any moment in the middle of next week finds next Monday correctly.
  const end = weekStart(new Date(start.getTime() + 8 * DAY_MS));
  return { start, end };
}

// How a kickoff time relates to the week that contains `now`.
export function weekOf(kickoffAt: string | Date, now: Date): "past" | "current" | "future" {
  const kickoff = new Date(kickoffAt).getTime();
  const { start, end } = weekRange(now);
  if (kickoff < start.getTime()) return "past";
  if (kickoff >= end.getTime()) return "future";
  return "current";
}

// "Fri 20 Nov" — the day the next round starts, for empty weeks. Shown in
// Bratislava time, the same clock as the match week, so the server and
// every visitor see the same day.
export function formatRoundStart(kickoffAt: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: WEEK_TIME_ZONE,
  }).format(new Date(kickoffAt));
}
