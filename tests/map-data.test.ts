import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { feature } from "topojson-client";

// The MapLibre map (the default engine) draws countries from files in
// public/, built by scripts/build-countries.mjs, whose current names are in
// src/lib/mapAssets.ts. These checks catch a broken rebuild before it
// reaches the map.

type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8"));
const read = (path: string) => readJson(path) as { features: Feature[] };

// The names the app loads (the generated module is plain constants).
const assets = Object.fromEntries(
  [...readFileSync(new URL("../src/lib/mapAssets.ts", import.meta.url), "utf8").matchAll(/export const (\w+) = "([^"]+)"/g)].map(
    (m) => [m[1], m[2]]
  )
);
// The shapes are TopoJSON; turned into GeoJSON the same way the app does it.
const topology = readJson(assets.COUNTRIES_URL.slice(1));
const countries = (feature(topology, topology.objects.countries) as unknown as { features: Feature[] }).features;
const labels = read(assets.COUNTRY_LABELS_URL.slice(1)).features;
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
      const glyphs = assets.GLYPHS_URL.replace("{fontstack}", assets.LABEL_FONT).replace("{range}", `${start}-${start + 255}`);
      const file = new URL(`../public${glyphs}`, import.meta.url);
      assert.ok(existsSync(file), `missing glyphs for "${ch}" in ${name}`);
    }
  }
});

test("the files the app asks for exist, and no file of an older build is left", () => {
  for (const url of [assets.COUNTRIES_URL, assets.COUNTRY_LABELS_URL]) {
    assert.ok(existsSync(new URL(`../public${url}`, import.meta.url)), url);
  }
  // Names carry a content hash and are cached for a year (next.config.ts):
  // exactly one version of each file may be published.
  assert.equal(readdirSync(new URL("../public/data", import.meta.url)).length, 2);
  assert.equal(readdirSync(new URL("../public/fonts", import.meta.url)).length, 1);
});

test("every country over 100,000 km² is labelled from world view, bigger ones placed first", () => {
  for (const f of labels) {
    const { name, area, minzoom } = f.properties as { name: string; area: number; minzoom: number };
    assert.equal(typeof area, "number", name);
    // The label layer starts at zoom 1, so minzoom 0 = shown at world view.
    if (area >= 100_000) assert.equal(minzoom, 0, `${name} (${area} km²) must be named at world view`);
  }
  for (const code of ["IT", "UA", "BY", "GR", "MA", "MG", "AF", "TM", "CM", "BR", "AR", "IN", "CN", "NG"]) {
    const f = labels.find((l) => l.properties.code === code)!;
    assert.equal(f.properties.minzoom, 0, code);
  }
});

test("Russia and Fiji are joined across 180° (no border line through Chukotka on the home-page map)", () => {
  // scripts/build-countries.mjs moves their parts just west of 180° to
  // 180–191° E and merges them with the rest (ACROSS_180).
  for (const code of ["RU", "FJ"]) {
    const f = countries.find((c) => c.properties.code === code)!;
    const polygons = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
    let maxLng = -Infinity;
    let alongMeridianKm = 0;
    for (const polygon of polygons)
      for (const ring of polygon)
        for (let i = 0; i < ring.length; i++) {
          maxLng = Math.max(maxLng, ring[i][0]);
          const onMeridian = (lng: number) => Math.abs(Math.abs(lng) - 180) < 0.001;
          if (i && onMeridian(ring[i][0]) && onMeridian(ring[i - 1][0])) alongMeridianKm += Math.abs(ring[i][1] - ring[i - 1][1]) * 111;
          assert.ok(ring[i][0] > -170, `${code} has a part west of 170° W left unjoined`);
        }
    assert.ok(maxLng > 180, `${code} doesn't reach past 180°`);
    assert.ok(alongMeridianKm < 1, `${code}: ${alongMeridianKm.toFixed(1)} km of edge along 180°`);
  }
  // Cape Dezhnev, Russia's eastern tip, at 190.3° E: inside the home map's 169° W – 191° E.
  const ru = countries.find((c) => c.properties.code === "RU")!;
  const lngs = ((ru.geometry.coordinates as number[][][][]).flat(2) as number[][]).map((p) => p[0]);
  assert.ok(Math.max(...lngs) < 191, "Russia must end before the home map's east edge (191° E)");
});
