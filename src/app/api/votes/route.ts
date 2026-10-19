import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Controlled server-side voting path (dev-prompt-chatgpt.md "ANTI-SPAM":
// "Voting backend implemented safely, no privileged DB keys exposed in
// frontend"). This route does exactly two things a browser can't do on its
// own: read the request's IP address, and call the submit_vote() Postgres
// function with the public anon key (the function itself is SECURITY
// DEFINER and does the actual privileged work — see docs/decisions-log.md
// 2026-10-19). No service-role key is used anywhere in this app.

type VoteRequestBody = {
  matchId?: unknown;
  teamId?: unknown;
  voterSeed?: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getClientIp(request: NextRequest): string {
  // Vercel (and most proxies) set x-forwarded-for; it can be a comma list
  // if there are multiple hops, so the client's address is the first one.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  // Local `next dev` has no proxy in front of it, so there's no header.
  // Falling back to a constant is fine there since every local vote would
  // collide anyway (same machine) — this path never runs in production.
  return "local-dev";
}

// The country a vote counts for is the voter's own location, determined
// server-side — NEVER a value the client sends. The whole product is "which
// country supports which team", so letting the client declare its own
// country would make every result trivially fake. Vercel's edge network
// sets this header automatically on every request in production, at no
// extra cost and no API key (see
// https://vercel.com/docs/edge-network/headers#x-vercel-ip-country).
// Locally (`next dev`) this header doesn't exist, so FANMAP_DEV_COUNTRY
// lets you pick a country to test with instead of every local vote being
// unattributable; see .env.example.
function getVoterCountry(request: NextRequest): string | null {
  const vercelCountry = request.headers.get("x-vercel-ip-country");
  if (vercelCountry) {
    return vercelCountry.toUpperCase();
  }
  const devCountry = process.env.FANMAP_DEV_COUNTRY;
  if (devCountry && /^[A-Za-z]{2}$/.test(devCountry)) {
    return devCountry.toUpperCase();
  }
  return null;
}

function computeVoterHash(ip: string, userAgent: string, seed: string): string {
  return createHash("sha256").update(`${seed}:${ip}:${userAgent}`).digest("hex");
}

export async function POST(request: NextRequest) {
  let body: VoteRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { matchId, teamId, voterSeed } = body;

  if (
    typeof matchId !== "string" ||
    !UUID_RE.test(matchId) ||
    typeof teamId !== "string" ||
    !UUID_RE.test(teamId) ||
    typeof voterSeed !== "string" ||
    voterSeed.length < 8
  ) {
    return NextResponse.json({ error: "Invalid vote payload" }, { status: 400 });
  }

  const countryCode = getVoterCountry(request);
  if (!countryCode) {
    // Only expected locally without FANMAP_DEV_COUNTRY set — see
    // getVoterCountry() above.
    return NextResponse.json(
      { error: "country_unknown", message: "Could not determine your country." },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const voterHash = computeVoterHash(ip, userAgent, voterSeed);

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("submit_vote", {
    p_match_id: matchId,
    p_team_id: teamId,
    p_country_code: countryCode,
    p_voter_hash: voterHash,
  });

  if (error) {
    // 23505 = unique_violation, i.e. votes_one_per_match_per_voter fired.
    // This is expected, routine behaviour (dev-prompt-chatgpt.md
    // "DUPLICATE VOTES": "Expected business behavior... must NOT crash the
    // app"), not a server error — the client shows a friendly toast for it.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "already_voted", message: "Your vote for this match is already recorded." },
        { status: 409 }
      );
    }
    console.error("submit_vote failed:", error);
    return NextResponse.json({ error: "vote_failed" }, { status: 400 });
  }

  return NextResponse.json({ vote: data }, { status: 201 });
}
