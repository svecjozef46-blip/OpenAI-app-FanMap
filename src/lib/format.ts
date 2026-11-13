"use client";

import { useClientValue } from "@/lib/useClientValue";

// Small display helpers shared across components.

// "Slovakia" from "SK". Intl.DisplayNames is built into every modern
// browser and Node, so no country-name table needs to be maintained.
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

// Kickoff time in the VIEWER's time zone. The server renders in UTC (it
// doesn't know the viewer's zone), so formatting directly in render would
// produce different text on server and client — a hydration mismatch.
// useClientValue renders the UTC version first, then the local one.
export function useKickoffLabel(iso: string): string {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  return useClientValue(
    () => new Date(iso).toLocaleString("en-GB", options).replace(",", " ·"),
    new Date(iso).toLocaleString("en-GB", { ...options, timeZone: "UTC" }).replace(",", " ·") + " UTC"
  );
}

// Percent split that always adds up to 100. With zero votes it returns
// 50/50 and `isEmpty`, so the UI can show a neutral placeholder instead of
// pretending there's real support.
export function splitPercent(home: number, away: number) {
  const total = home + away;
  if (total === 0) return { homePct: 50, awayPct: 50, total, isEmpty: true };
  const homePct = Math.round((home / total) * 100);
  return { homePct, awayPct: 100 - homePct, total, isEmpty: false };
}
