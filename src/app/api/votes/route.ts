import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyTurnstileToken, type TurnstileResult } from "@/lib/turnstileServer";
import { computeIpHash, getClientIp, logDbError } from "@/lib/clientIp";
import { getMapBudgetStatus } from "@/lib/mapBudgetServer";
import { pausedMessage } from "@/lib/mapBudgetMessage";

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
  turnstileToken?: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// Our own automated tests (tests/voting.test.ts) can't solve a Turnstile
// challenge, and they send many votes in a row. They identify themselves
// with the server secret in this header, which skips the human check and
// the rate limit. That gives away nothing: whoever knows the secret could
// already record votes straight in the database.
function isTrustedTestCaller(request: NextRequest, serverSecret: string): boolean {
  const given = request.headers.get("x-fanmap-test-secret");
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(serverSecret).digest();
  return timingSafeEqual(a, b);
}

const UNAVAILABLE = { error: "not_configured", message: "Voting is temporarily unavailable. Please try again later." };
const NOT_VERIFIED = {
  error: "verification_failed",
  message: "We couldn't confirm you're a real fan. Please reload the page and try again.",
};

export async function POST(request: NextRequest) {
  let body: VoteRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Something went wrong sending your vote. Please reload the page and try again." },
      { status: 400 }
    );
  }

  const { matchId, teamId, voterSeed, turnstileToken } = body;

  if (
    typeof matchId !== "string" ||
    !UUID_RE.test(matchId) ||
    typeof teamId !== "string" ||
    !UUID_RE.test(teamId) ||
    typeof voterSeed !== "string" ||
    voterSeed.length < 8
  ) {
    return NextResponse.json(
      { error: "invalid_request", message: "Something went wrong sending your vote. Please reload the page and try again." },
      { status: 400 }
    );
  }

  const countryCode = getVoterCountry(request);
  if (!countryCode) {
    // Only expected locally without FANMAP_DEV_COUNTRY set — see
    // getVoterCountry() above.
    return NextResponse.json(
      { error: "country_unknown", message: "We couldn't tell which country you're in, so your vote can't be counted." },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const voterHash = computeVoterHash(ip, userAgent, voterSeed);

  // Proves to the database that this vote comes from our server, not from
  // someone calling submit_vote() directly with the public key (which would
  // let them invent the country and the voter). Server-only: the variable
  // has no NEXT_PUBLIC_ prefix, so it never reaches the browser.
  const serverSecret = process.env.FANMAP_VOTE_SECRET;
  if (!serverSecret) {
    console.error("FANMAP_VOTE_SECRET is not set — votes cannot be recorded. See README.");
    return NextResponse.json(
      { error: "not_configured", message: "Voting is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const supabase = createServerSupabaseClient();

  if (!isTrustedTestCaller(request, serverSecret)) {
    // Two checks before a vote is recorded. They don't depend on each
    // other, so they run at the same time — the fan waits for the slower
    // one, not for both in a row.

    // 1) Rate limit per IP address. The limit itself (20 a minute, 300 an
    // hour) lives in register_vote_attempt() in docs/schema.sql; the
    // reasoning is in docs/decisions-log.md.
    const rateCheck = supabase
      .rpc("register_vote_attempt", {
        p_ip_hash: computeIpHash(ip, serverSecret),
        p_server_secret: serverSecret,
      })
      .then((result) => result);

    // 2) Human check (Cloudflare Turnstile). No valid token, no vote.
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    const hasToken =
      typeof turnstileToken === "string" && turnstileToken.length > 0 && turnstileToken.length <= 2048;
    const humanCheck: Promise<TurnstileResult | "skipped"> = turnstileSecret
      ? hasToken
        ? verifyTurnstileToken(turnstileSecret, turnstileToken as string, ip === "local-dev" ? null : ip)
        : Promise.resolve("rejected")
      : // Never run the live site without the human check by accident;
        // local development without Turnstile keys skips it.
        Promise.resolve(process.env.NODE_ENV === "production" ? "unavailable" : "skipped");

    // 3) Monthly map budget (lib/mapBudgetServer.ts): once it is used up,
    // voting pauses until the 1st of next month together with the map. A
    // database hiccup here (null) doesn't block votes.
    const budgetCheck = getMapBudgetStatus(supabase);

    const [{ data: allowed, error: rateError }, verdict, budget] = await Promise.all([
      rateCheck,
      humanCheck,
      budgetCheck,
    ]);

    if (budget?.paused) {
      return NextResponse.json(
        { error: "voting_paused", message: pausedMessage(budget.resetsOn), resetsOn: budget.resetsOn },
        { status: 503 }
      );
    }

    if (rateError) {
      logDbError("register_vote_attempt failed", rateError);
      return NextResponse.json(UNAVAILABLE, { status: 503 });
    }
    if (allowed === false) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many votes from your network right now. Please wait a minute and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    if (verdict === "unavailable") {
      if (!turnstileSecret) {
        console.error("TURNSTILE_SECRET_KEY is not set — votes cannot be recorded. See README.");
      }
      return NextResponse.json(UNAVAILABLE, { status: 503 });
    }
    if (verdict === "rejected") {
      return NextResponse.json(NOT_VERIFIED, { status: 403 });
    }
  }

  const { data, error } = await supabase.rpc("submit_vote", {
    p_match_id: matchId,
    p_team_id: teamId,
    p_country_code: countryCode,
    p_voter_hash: voterHash,
    p_server_secret: serverSecret,
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
    // 42501 = the database didn't accept our server secret (missing or
    // different from the one registered in server_secrets).
    if (error.code === "42501") {
      console.error("submit_vote rejected the server secret — check FANMAP_VOTE_SECRET. See README.");
      return NextResponse.json(
        { error: "not_configured", message: "Voting is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }
    // VC001 = our own "voting closed" code, raised by submit_vote() when
    // the match is finished or archived (see docs/schema.sql).
    if (error.code === "VC001") {
      return NextResponse.json(
        { error: "voting_closed", message: "Voting for this match has closed." },
        { status: 403 }
      );
    }
    logDbError("submit_vote failed", error);
    return NextResponse.json(
      { error: "vote_failed", message: "We couldn't count your vote. Please try again." },
      { status: 400 }
    );
  }

  // Only what the vote is about: never the voter identifier (voter_hash),
  // which the database row also contains.
  const { id, match_id, team_id, country_code, created_at } = data as Record<string, unknown>;
  return NextResponse.json({ vote: { id, match_id, team_id, country_code, created_at } }, { status: 201 });
}
