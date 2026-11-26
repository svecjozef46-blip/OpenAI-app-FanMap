// Wording for the monthly map budget (see lib/mapBudgetServer.ts), shared by
// the server (vote API answer) and the browser (banner, map, vote buttons)
// so every place says the same thing.

// "2026-12-01" -> "1 December". UTC on purpose: the budget month is a UTC
// calendar month, so the date must not shift by a day in other time zones.
export function formatResetDate(resetsOn: string | null): string | null {
  if (!resetsOn || !/^\d{4}-\d{2}-\d{2}$/.test(resetsOn)) return null;
  const date = new Date(`${resetsOn}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function pausedMessage(resetsOn: string | null): string {
  const date = formatResetDate(resetsOn);
  return date
    ? `Voting is paused until ${date} — we've reached this month's visitor limit. Thanks for your patience!`
    : "Voting is paused for now — we've reached this month's visitor limit. Thanks for your patience!";
}
