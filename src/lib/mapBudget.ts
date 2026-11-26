"use client";

import { useSyncExternalStore } from "react";

// Monthly map budget, browser side (server side: lib/mapBudgetServer.ts).
// One shared state for the whole page: the banner, the maps and the vote
// buttons all read it, so they always agree on whether the site is paused.

export type MapBudget = { paused: boolean; resetsOn: string | null };

let current: MapBudget | null = null; // null = not known yet
let statusRequested = false;
const listeners = new Set<() => void>();

function publish(next: MapBudget) {
  if (current && current.paused === next.paused && current.resetsOn === next.resetsOn) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function parse(body: unknown): MapBudget | null {
  if (!body || typeof body !== "object") return null;
  const { paused, resetsOn } = body as { paused?: unknown; resetsOn?: unknown };
  if (typeof paused !== "boolean") return null;
  return { paused, resetsOn: typeof resetsOn === "string" ? resetsOn : null };
}

async function loadStatus() {
  try {
    const response = await fetch("/api/map-load");
    if (!response.ok) return;
    const next = parse(await response.json());
    if (next) publish(next);
  } catch {
    // Offline or server unreachable: say nothing rather than guess.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!statusRequested) {
    statusRequested = true;
    void loadStatus();
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useMapBudget(): MapBudget | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
}

// Snapshot for event handlers (e.g. a vote click).
export function getMapBudget(): MapBudget | null {
  return current;
}

// The vote API answered "paused" (it checks on its own).
export function markPaused(resetsOn: string | null) {
  publish({ paused: true, resetsOn });
}

// Counts one map start. Each map calls this right before creating Mapbox
// and only starts when it returns true. Any failure (no answer, rate limit,
// server error) returns true: a broken counter must never hide the map from
// real fans; the 1,000-start margin below Mapbox's free 50,000 absorbs it.
export async function claimMapLoad(): Promise<boolean> {
  try {
    const response = await fetch("/api/map-load", { method: "POST" });
    if (!response.ok) {
      if (response.status !== 429) console.error("Map budget check failed:", response.status);
      return true;
    }
    const next = parse(await response.json());
    if (!next) return true;
    publish(next);
    return !next.paused;
  } catch {
    return true;
  }
}
