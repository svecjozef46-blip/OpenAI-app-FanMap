#!/usr/bin/env node
// Checks that every country code that votes are stored with has a shape on
// the MapLibre map (public/data/countries.geojson, built by
// scripts/build-countries.mjs). A code without a shape means votes from that
// country would count but never color the map.
//
// Codes come from the database. In the Supabase SQL editor run
//   select string_agg(distinct country_code, ' ') from votes;
// and pass the result:
//   node scripts/check-country-codes.mjs SK CZ DE …
// (or pipe them in: … | node scripts/check-country-codes.mjs)
//
// With --all it also checks every ISO 3166-1 alpha-2 code, i.e. every value
// x-vercel-ip-country can have, and explains the expected gaps.
//
// Exit code 1 when a code from the database has no shape.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const countries = JSON.parse(await readFile(path.join(ROOT, "public/data/countries.geojson"), "utf8"));
const onMap = new Set(countries.features.map((f) => f.properties.code));

// Codes intentionally or unavoidably without a shape.
const KNOWN_GAPS = {
  AQ: "Antarctica, left out of the map on purpose (decisions-log 2026-11-14)",
  BV: "Bouvet Island, uninhabited; not in Natural Earth's US edition",
  EU: "not a country (some IP databases use it for 'somewhere in Europe')",
  AP: "not a country ('Asia/Pacific region')",
  T1: "not a country (Tor exit node in some IP databases)",
};

// All officially assigned ISO 3166-1 alpha-2 codes, plus XK (Kosovo, which
// IP databases and Vercel use although ISO has not assigned it).
const regionNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
function allIsoCodes() {
  const codes = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      // Intl knows names for assigned codes and some reserved ones; these
      // are reserved/transitional, not countries.
      if (["AC", "CP", "DG", "EA", "EU", "EZ", "IC", "QO", "TA", "UN", "ZZ", "XA", "XB", "CQ"].includes(code)) continue;
      if (!regionNames.of(code)) continue;
      // Withdrawn codes (UK, SU, YU, ZR…) are aliases of current ones.
      if (new Intl.Locale(`und-${code}`).maximize().region !== code) continue;
      codes.push(code);
    }
  }
  return codes;
}

const args = process.argv.slice(2);
const checkAll = args.includes("--all");
let codes = args.filter((a) => a !== "--all");
if (!codes.length && !process.stdin.isTTY) {
  codes = (await new Response(process.stdin).text()).split(/[\s,]+/);
}
codes = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))].sort();

let failed = false;
if (codes.length) {
  const missing = codes.filter((c) => !onMap.has(c));
  console.log(`Codes from votes: ${codes.length}, on the map: ${codes.length - missing.length}`);
  if (missing.length) {
    failed = true;
    console.log("Without a shape:");
    for (const c of missing) console.log(`  ${c}  ${KNOWN_GAPS[c] ?? regionNames.of(c) ?? "(unknown code)"}`);
  } else {
    console.log("Without a shape: none");
  }
}

if (checkAll) {
  const missing = allIsoCodes().filter((c) => !onMap.has(c));
  console.log(`\nAll ISO 3166-1 codes (+XK) without a shape: ${missing.length}`);
  for (const c of missing) console.log(`  ${c}  ${KNOWN_GAPS[c] ?? regionNames.of(c)}`);
}

if (!codes.length && !checkAll) {
  console.log("Pass country codes (see the comment at the top of this file) or --all.");
}
process.exit(failed ? 1 : 0);
