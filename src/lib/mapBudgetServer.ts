import type { SupabaseClient } from "@supabase/supabase-js";

// MONTHLY MAP BUDGET (server side). Mapbox bills every map start above
// 50,000 a month (docs/naklady). The site counts its own map starts in the
// database (map_load_counter, register_map_load() in docs/schema.sql) and,
// once this month's count reaches the limit, stops starting maps AND pauses
// voting until the 1st of next month (UTC). A small margin below 50,000
// covers map starts the counter can't see (Mapbox counts a new one after
// 12 hours on the same page; a start whose count failed is let through).
//
// To keep going past the limit (and pay Mapbox), set MAP_LOAD_LIMIT in
// Vercel to a higher number and redeploy.
export const DEFAULT_MAP_LOAD_LIMIT = 49_000;

export function getMapLoadLimit(): number {
  const raw = process.env.MAP_LOAD_LIMIT;
  if (!raw) return DEFAULT_MAP_LOAD_LIMIT;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAP_LOAD_LIMIT;
}

export type MapBudgetStatus = { paused: boolean; resetsOn: string | null };

// Read-only check (does not count a map start). Returns null when the
// database can't answer — callers then carry on as if not paused, so a
// database hiccup never blocks the whole site.
export async function getMapBudgetStatus(supabase: SupabaseClient): Promise<MapBudgetStatus | null> {
  const { data, error } = await supabase.rpc("get_map_budget", { p_limit: getMapLoadLimit() });
  if (error) {
    console.error("get_map_budget failed:", error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.paused !== "boolean") return null;
  return { paused: row.paused, resetsOn: typeof row.resets_on === "string" ? row.resets_on : null };
}
