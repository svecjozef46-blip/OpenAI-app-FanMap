#!/usr/bin/env node
// Builds the country shapes, label points and label font used by the
// MapLibre version of the map (NEXT_PUBLIC_MAP_ENGINE=maplibre). The output
// is committed, so the app never downloads map data from anyone at run time:
//
//   public/data/countries.geojson        one feature per country, id = ISO alpha-2
//   public/data/country-labels.geojson   one point per country, for the name labels
//   public/fonts/Open Sans Semibold/     glyph ranges (.pbf) the labels need
//
// Run again only to update the data:   node scripts/build-countries.mjs
// (downloads ~13 MB once into scripts/.cache, which git ignores).
//
// Sources (see docs/maplibre.md for licenses and decisions):
// - Natural Earth 1:10m Admin 0 countries, "United States point of view"
//   edition (public domain), pinned to a release tag. The US edition is used
//   because Mapbox's default worldview, the one our Mapbox map shows, is also
//   the US one. 10m is simplified here to roughly 50m detail, but unlike the
//   ready-made 50m file it still has every small state (Malta, Singapore,
//   Monaco, San Marino, Vatican, Liechtenstein, Andorra…).
// - Open Sans Semibold glyphs from openmaptiles/fonts (Apache License 2.0).

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "scripts/.cache");
const OUT_DATA = path.join(ROOT, "public/data");
const FONT = "Open Sans Semibold";
const OUT_FONT = path.join(ROOT, "public/fonts", FONT);

const NE_VERSION = "v5.1.2";
const NE_FILE = "ne_10m_admin_0_countries_usa.geojson";
const NE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_VERSION}/geojson/${NE_FILE}`;
// Commit of openmaptiles/fonts' gh-pages branch the glyphs were taken from
// (pinned, so a rebuild gives the same files).
const FONTS_URL = "https://raw.githubusercontent.com/openmaptiles/fonts/025ff2b2f84cc0fdf11f7b1d74b3a784595fe7a4";

// How much of the 10m detail to keep. A fixed share for every country (tried
// 4%, 15% and 25%, compared on screen against Mapbox on 2026-11-26) either
// looks angular when zoomed to Luxembourg or turns Malta into a triangle and
// drops Gozo, because it takes most from the smallest shapes. Instead each
// country gets its own tolerance, proportional to its size: ~80 m for
// microstates, ~200 m for Luxembourg, ~900 m for Slovakia, up to 4 km for
// Russia or Canada. Result: 1.8 MB (~0.6 MB gzipped). keep-shapes keeps every
// small island.
const SIMPLIFY = "variable interval='Math.min(4000, Math.max(80, Math.sqrt(this.area) / 250))'";
// Coordinates rounded to 0.001° (~100 m): invisible at the zoom levels the
// map allows, and a third of the file size.
const PRECISION = 0.001;

// --- Country codes ----------------------------------------------------------
// votes.country_code is the ISO 3166-1 alpha-2 code from Vercel's
// x-vercel-ip-country header. Natural Earth's ISO_A2 is "-99" for several
// countries (France, Norway, Kosovo…); ISO_A2_EH ("except here") fixes most
// of them. The rest, by Natural Earth's ADM0_A3 code:
const CODE_BY_ADM0 = {
  ESB: "CY", // Dhekelia (UK base area on Cyprus) → drawn as part of Cyprus
  WSB: "CY", // Akrotiri, same
  USG: "CU", // Guantanamo Bay → Cuba
  BRI: "BR", // Brazilian Island (river island, Brazil/Uruguay)
  CSI: "AU", // Coral Sea Islands
  ATC: "AU", // Ashmore and Cartier Islands
  CLP: "FR", // Clipperton Island
};
// Uninhabited, disputed specks with no country code: left out.
const DROP_ADM0 = new Set([
  "BRT", // Bir Tawil (claimed by nobody)
  "PGA", // Spratly Islands
  "SCR", // Scarborough Shoal
  "ATA", // Antarctica (also dropped by code below)
]);

// Parts of a country that have their own ISO code (and so their own
// x-vercel-ip-country value) but that Natural Earth draws as part of the
// mother country. Each polygon is moved to the code whose test matches its
// centre [lng, lat]. Matches how Mapbox's country-boundaries tileset splits
// them, so e.g. a vote from Réunion colors Réunion, not mainland France.
const SPLITS = {
  FR: [
    ["GF", ([x, y]) => x < -50 && x > -55 && y < 6.5], // French Guiana
    ["GP", ([x, y]) => x < -60.9 && x > -62 && y > 15.7 && y < 16.6], // Guadeloupe
    ["MQ", ([x, y]) => x < -60.7 && x > -61.3 && y > 14.3 && y < 15], // Martinique
    ["RE", ([x, y]) => x > 55 && x < 56 && y < -20.5 && y > -21.5], // Réunion
    ["YT", ([x, y]) => x > 44.9 && x < 45.4 && y < -12.5 && y > -13.1], // Mayotte
  ],
  NO: [["SJ", ([x, y]) => y >= 74 || x < -5]], // Svalbard, Jan Mayen
  NL: [["BQ", ([x]) => x < -60]], // Bonaire, Sint Eustatius, Saba
  NZ: [["TK", ([, y]) => y > -10.5]], // Tokelau
  AU: [], // filled for IOA below
};
// Australia's Indian Ocean Territories are one Natural Earth feature but two
// ISO codes.
const IOA_SPLIT = [
  ["CX", ([x]) => x > 100], // Christmas Island
  ["CC", () => true], // Cocos (Keeling) Islands
];

// Names for the labels. Same source as the hover tooltip (Intl, see
// countryName() in src/lib/format.ts), with the few CLDR names that read
// oddly on a map shortened.
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const LABEL_NAME = {
  CD: "DR Congo",
  CG: "Congo",
  MM: "Myanmar",
  BA: "Bosnia and Herzegovina",
  PS: "Palestine",
  HK: "Hong Kong",
  MO: "Macao",
  US: "United States",
  GB: "United Kingdom",
  CF: "Central African Rep.",
  VA: "Vatican City",
  UM: "U.S. Outlying Islands",
  VI: "U.S. Virgin Islands",
};
const labelName = (code) => (LABEL_NAME[code] ?? regionNames.of(code) ?? code).replace(/’/g, "'");

// --- Helpers ----------------------------------------------------------------

async function download(url, file) {
  if (existsSync(file)) return;
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
}

function ringCentre(ring) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

const polygonsOf = (geometry) => (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates);

// --- 1. Read Natural Earth and assign one valid code per polygon ------------

const neFile = path.join(CACHE, `${NE_VERSION}-${NE_FILE}`);
await download(NE_URL, neFile);
const ne = JSON.parse(await readFile(neFile, "utf8"));

const features = []; // { code, polygon } pieces, dissolved by code below
const labelSource = new Map(); // code → Natural Earth properties (label point, rank)
const problems = [];

for (const f of ne.features) {
  const p = f.properties;
  if (DROP_ADM0.has(p.ADM0_A3)) continue;
  let code = CODE_BY_ADM0[p.ADM0_A3] ?? p.ISO_A2_EH;
  if (code === "AQ") continue; // no Antarctica
  if (!/^[A-Z]{2}$/.test(code ?? "")) {
    problems.push(`${p.ADM0_A3} ${p.NAME_EN}: no usable ISO code (${p.ISO_A2}/${p.ISO_A2_EH})`);
    continue;
  }
  const splits = p.ADM0_A3 === "IOA" ? IOA_SPLIT : SPLITS[code] ?? [];
  for (const polygon of polygonsOf(f.geometry)) {
    const centre = ringCentre(polygon[0]);
    const split = splits.find(([, test]) => test(centre));
    features.push({ code: split ? split[0] : code, polygon });
  }
  // The label point of the country itself (not of a split-off part or a
  // merged breakaway region, which keep their mother country's label).
  if (!CODE_BY_ADM0[p.ADM0_A3] && p.ADM0_A3 !== "IOA" && (!labelSource.has(code) || p.TYPE !== "Breakaway")) {
    if (!labelSource.has(code) || labelSource.get(code).POP_EST < p.POP_EST) labelSource.set(code, p);
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const pieces = {
  type: "FeatureCollection",
  features: features.map(({ code, polygon }) => ({
    type: "Feature",
    properties: { code },
    geometry: { type: "Polygon", coordinates: polygon },
  })),
};

// --- 2. Merge, simplify and round with mapshaper ----------------------------
// dissolve2 really merges the pieces of a code into one shape (so e.g.
// Abkhazia + Georgia show no inner border line); -clean fixes the tiny
// overlaps and gaps simplification leaves between neighbours.

const shaped = await mapshaper.applyCommands(
  [
    "-i pieces.json",
    "-dissolve2 code",
    `-simplify ${SIMPLIFY} keep-shapes`,
    "-clean",
    "-sort code",
    `-o countries.geojson format=geojson precision=${PRECISION}`,
  ].join(" "),
  { "pieces.json": JSON.stringify(pieces) }
);
const countries = JSON.parse(shaped["countries.geojson"]);

// --- 3. Label points --------------------------------------------------------
// Natural Earth's hand-placed LABEL_X/LABEL_Y where it has them; otherwise
// (split-off parts) a point inside the shape. `rank` = Natural Earth's
// MIN_LABEL, the zoom from which the name fits (big countries first, as on
// the Mapbox map), two levels later for territories that belong to another
// country (Bermuda, Guernsey, Pitcairn…) and one later for microstates under
// 1,000 km² (Monaco, Vatican, Malta…), which Mapbox doesn't label at world or
// Europe zoom either.
const isDependency = (p) => p.SOVEREIGNT !== p.ADMIN;

const innerPoints = JSON.parse(
  (
    await mapshaper.applyCommands("-i c.json -each 'km2 = this.area / 1e6' -points inner -o p.json format=geojson precision=0.001", {
      "c.json": JSON.stringify(countries),
    })
  )["p.json"]
);
const innerPoint = new Map(innerPoints.features.map((f) => [f.properties.code, f.geometry.coordinates]));
const areaKm2 = new Map(innerPoints.features.map((f) => [f.properties.code, f.properties.km2]));

const labels = {
  type: "FeatureCollection",
  features: countries.features.map((f) => {
    const code = f.properties.code;
    const p = labelSource.get(code);
    const coordinates = p ? [p.LABEL_X, p.LABEL_Y].map((n) => Math.round(n * 1000) / 1000) : innerPoint.get(code);
    return {
      type: "Feature",
      properties: {
        code,
        name: labelName(code),
        rank: (p ? p.MIN_LABEL + (isDependency(p) ? 2 : 0) : 7) + (areaKm2.get(code) < 1000 ? 1 : 0),
        size: p ? p.LABELRANK : 6,
      },
      geometry: { type: "Point", coordinates },
    };
  }),
};

// --- 4. Write --------------------------------------------------------------

await mkdir(OUT_DATA, { recursive: true });
const countriesJson = JSON.stringify(countries);
await writeFile(path.join(OUT_DATA, "countries.geojson"), countriesJson + "\n");
await writeFile(path.join(OUT_DATA, "country-labels.geojson"), JSON.stringify(labels) + "\n");

// --- 5. Glyphs: only the ranges the label names use -------------------------

const ranges = new Set();
for (const f of labels.features) {
  for (const ch of f.properties.name) {
    const start = Math.floor(ch.codePointAt(0) / 256) * 256;
    ranges.add(`${start}-${start + 255}`);
  }
}
await mkdir(OUT_FONT, { recursive: true });
for (const range of ranges) {
  const file = path.join(OUT_FONT, `${range}.pbf`);
  await download(`${FONTS_URL}/${encodeURIComponent(FONT)}/${range}.pbf`, file);
}

const kb = async (file) => `${Math.round((await stat(file)).size / 1024)} KB`;
console.log(
  `countries.geojson: ${countries.features.length} countries, ${await kb(path.join(OUT_DATA, "countries.geojson"))}`
);
console.log(`country-labels.geojson: ${await kb(path.join(OUT_DATA, "country-labels.geojson"))}`);
console.log(`glyph ranges: ${[...ranges].join(", ")}`);
