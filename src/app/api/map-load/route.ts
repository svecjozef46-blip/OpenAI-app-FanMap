import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeIpHash, getClientIp } from "@/lib/clientIp";
import { getMapBudgetStatus, getMapLoadLimit } from "@/lib/mapBudgetServer";

// Monthly map budget (see lib/mapBudgetServer.ts).
//
// GET  -> { paused, resetsOn } — only reads. Cached by Vercel's CDN for 30 s,
//         so the banner on every page costs almost nothing.
// POST -> counts one map start and answers whether the map may start. Called
//         by each map (GlobalMap, HeroMap) right before it creates Mapbox.
//
// Neither answer ever contains the count itself (traffic stays private).

export async function GET() {
  const supabase = createServerSupabaseClient();
  const status = await getMapBudgetStatus(supabase);
  if (!status) {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(status, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" },
  });
}

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const serverSecret = process.env.FANMAP_VOTE_SECRET;
  if (!serverSecret) {
    console.error("FANMAP_VOTE_SECRET is not set — map starts are not counted. See README.");
    return NextResponse.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  }

  const supabase = createServerSupabaseClient();

  // Without a per-address limit, one script could use up the whole month's
  // budget and pause the site for everyone. Same limiter as voting (20 a
  // minute, 300 an hour per address), but a separate bucket ("map:").
  const { data: underLimit, error: rateError } = await supabase.rpc("register_vote_attempt", {
    p_ip_hash: computeIpHash(getClientIp(request), serverSecret, "map:"),
    p_server_secret: serverSecret,
  });
  if (rateError) {
    console.error("register_vote_attempt (map) failed:", rateError);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
  if (underLimit === false) {
    // Not counted. The browser lets a real visitor's map start anyway (see
    // lib/mapBudget.ts); what matters is that a flood can't fill the counter.
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  const { data, error } = await supabase.rpc("register_map_load", {
    p_server_secret: serverSecret,
    p_limit: getMapLoadLimit(),
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || typeof row.allowed !== "boolean") {
    console.error("register_map_load failed:", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
  return NextResponse.json(
    { paused: !row.allowed, resetsOn: typeof row.resets_on === "string" ? row.resets_on : null },
    { headers: NO_STORE }
  );
}
