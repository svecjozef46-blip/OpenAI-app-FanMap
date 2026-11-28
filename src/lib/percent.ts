// Percent split shown next to every match. Pure functions with no imports,
// so tests can load this file directly (format.ts uses the @/ alias, which
// plain Node cannot resolve). format.ts re-exports both.

// How many decimals the percentages get. Whole percents are fine for a few
// thousand votes, but with hundreds of thousands a 1% gap is thousands of
// votes and "51% · 49%" hides a close race, so the precision grows with the
// total: 10,000+ votes → one decimal (0.1% ≈ 10 votes at 10,000, ≈ 1,000 at
// 1,000,000), 10,000,000+ → two decimals.
export function percentDecimals(total: number): number {
  if (total >= 10_000_000) return 2;
  if (total >= 10_000) return 1;
  return 0;
}

// Percent split that always adds up to 100. With zero votes it returns
// 50/50 and `isEmpty`, so the UI can show a neutral placeholder instead of
// pretending there's real support. `homePct`/`awayPct` are numbers (for bar
// widths); `homeText`/`awayText` are the same values as strings with a fixed
// number of decimals ("50.3", never "50.30000000000001") for display.
export function splitPercent(home: number, away: number) {
  const total = home + away;
  if (total === 0) return { homePct: 50, awayPct: 50, homeText: "50", awayText: "50", total, isEmpty: true };
  const decimals = percentDecimals(total);
  const scale = 10 ** decimals;
  // Integer math keeps the two sides adding up to exactly 100.
  const homeScaled = Math.round((home / total) * 100 * scale);
  const awayScaled = 100 * scale - homeScaled;
  return {
    homePct: homeScaled / scale,
    awayPct: awayScaled / scale,
    homeText: (homeScaled / scale).toFixed(decimals),
    awayText: (awayScaled / scale).toFixed(decimals),
    total,
    isEmpty: false,
  };
}
