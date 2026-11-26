import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// The MapLibre version of the map (NEXT_PUBLIC_MAP_ENGINE=maplibre) draws
// countries from files in public/, built by scripts/build-countries.mjs.
// These checks catch a broken rebuild before it reaches the map.

type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8")) as { features: Feature[] };

const countries = read("data/countries.geojson").features;
const labels = read("data/country-labels.geojson").features;
const codes = countries.map((f) => f.properties.code as string);

test("every country shape has a unique ISO alpha-2 code (the format of votes.country_code)", () => {
  for (const code of codes) assert.match(code, /^[A-Z]{2}$/);
  assert.equal(new Set(codes).size, codes.length, "duplicate codes");
  for (const f of countries) assert.match(f.geometry.type, /^(Multi)?Polygon$/);
});

test("no Antarctica (decisions-log 2026-11-14)", () => {
  assert.ok(!codes.includes("AQ"));
});

test("every country a visitor can vote from has a shape", () => {
  // All current ISO 3166-1 codes Intl knows, plus Kosovo (XK). Expected
  // gaps: Antarctica (on purpose) and uninhabited Bouvet Island.
  const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  const reserved = ["AC", "CP", "CQ", "DG", "EA", "EU", "EZ", "IC", "QO", "TA", "UN", "XA", "XB", "ZZ"];
  const missing: string[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (reserved.includes(code) || !names.of(code)) continue;
      if (new Intl.Locale(`und-${code}`).maximize().region !== code) continue; // withdrawn alias
      if (!codes.includes(code)) missing.push(code);
    }
  }
  assert.deepEqual(missing.sort(), ["AQ", "BV"]);
});

test("small states the product cares about are on the map", () => {
  for (const code of ["SK", "LU", "MT", "SG", "XK", "MC", "SM", "VA", "LI", "AD"]) {
    assert.ok(codes.includes(code), code);
  }
});

test("every country has one label, and the font has every character the labels use", () => {
  assert.deepEqual(labels.map((f) => f.properties.code).sort(), [...codes].sort());
  for (const f of labels) {
    assert.equal(f.geometry.type, "Point");
    const name = f.properties.name as string;
    assert.ok(name.length > 0);
    for (const ch of name) {
      const start = Math.floor(ch.codePointAt(0)! / 256) * 256;
      const file = new URL(`../public/fonts/Open Sans Semibold/${start}-${start + 255}.pbf`, import.meta.url);
      assert.ok(existsSync(file), `missing glyphs for "${ch}" in ${name}`);
    }
  }
});
