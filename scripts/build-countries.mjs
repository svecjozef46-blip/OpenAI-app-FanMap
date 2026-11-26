#!/usr/bin/env node
// Builds the country shapes, label points and label font used by the
// MapLibre version of the map (NEXT_PUBLIC_MAP_ENGINE=maplibre). The output
// is committed, so the app never downloads map data from anyone at run time:
//
//   public/data/countries.<hash>.topo.json      one shape per country, id = ISO alpha-2 (TopoJSON)
//   public/data/country-labels.<hash>.geo.json  one point per country, for the name labels (GeoJSON)
//   public/fonts/<hash>/<font>/<range>.pbf      glyphs the labels need (scripts/build-glyphs.mjs)
//   src/lib/mapAssets.ts                        the current file names, for the app
//
// <hash> is a hash of the content, so a changed file gets a new name and the
// files can be cached by browsers for a year (headers() in next.config.ts).
// Files of an earlier build are deleted.
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
// - The label font, built from Google Fonts' TTF by scripts/build-glyphs.mjs
//   (see FONT below and docs/maplibre.md).

import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";
import { buildGlyphs } from "./build-glyphs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "scripts/.cache");
const OUT_DATA = path.join(ROOT, "public/data");
const OUT_FONTS = path.join(ROOT, "public/fonts");
const ASSETS_TS = path.join(ROOT, "src/lib/mapAssets.ts");
// Label font: chosen by comparing screenshots against Mapbox's DIN Pro
// (docs/maplibre.md). LABEL_FONT=... overrides it for such comparisons.
const FONT = process.env.LABEL_FONT ?? "Barlow Semi Condensed SemiBold";

const NE_VERSION = "v5.1.2";
const NE_FILE = "ne_10m_admin_0_countries_usa.geojson";
const NE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_VERSION}/geojson/${NE_FILE}`;

// How much of the 10m detail to keep. A fixed share for every country (tried
// 4%, 15% and 25%, compared on screen against Mapbox on 2026-11-26) either
// looks angular when zoomed to Luxembourg or turns Malta into a triangle and
// drops Gozo, because it takes most from the smallest shapes. Instead each
// country gets its own tolerance, proportional to its size: ~80 m for
// microstates, ~200 m for Luxembourg, ~900 m for Slovakia, up to 4 km for
// Russia or Canada. keep-shapes keeps every small island.
const SIMPLIFY = "variable interval='Math.min(4000, Math.max(80, Math.sqrt(this.area) / 250))'";
// Coordinates rounded to 0.001° (~100 m) while processing: invisible at the
// zoom levels the map allows (up to 7).
const PRECISION = 0.001;
// The file itself is TopoJSON: each border is stored once (not once per
// neighbour) and coordinates as small whole-number steps on a grid of
// 500,000 × 500,000 over the world (~0.0007°, ~70 m, finer than the
// rounding above). The same shapes as GeoJSON were 1.8 MB, ~550 KB with the
// brotli level a CDN uses on the fly; as TopoJSON they are ~300 KB.
// The browser turns it back into GeoJSON (topojson-client, lib/mapEngineMaplibre.ts).
const QUANTIZATION = 500_000;

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
// Where: Natural Earth's hand-placed LABEL_X/LABEL_Y where it has them (not
// the centre of the shape: Italy, Norway or Chile have theirs where the
// name reads best), otherwise (split-off parts) a point inside the shape,
// with a few corrections in LABEL_POINT.
// Which first: the bigger the country, the higher its priority when names
// collide (`area`, used as symbol-sort-key), and the earlier it appears
// (`minzoom`, from its area): every country over 100,000 km² is named at
// world view, the smallest ones only once zoomed in. Smaller territories that
// belong to another country (Bermuda, Guernsey…) one zoom level later still.
// How big: `symbolrank` = Natural Earth's LABELRANK (1 = largest), the same
// scale Mapbox's country labels use for their text size, but at least 4
// (the middle size) for countries under 500,000 km².
const isDependency = (p) => p.SOVEREIGNT !== p.ADMIN;
const LABEL_POINT = {
  IT: [12.4, 42.9], // NE's point is in the Po valley; the boot reads better
  HR: [16.0, 45.6],
  NO: [9.0, 61.5],
  // NE's points sit at the crowded edge next to their neighbours; at world
  // view the names then had no room (checked with tools/labels.cjs).
  CM: [12.8, 6.0],
  ZM: [27.5, -13.6],
};
// Football countries that would otherwise lose their name to bigger but
// quieter neighbours in crowded regions (West and Central Africa at world
// view): they win collisions as if they were four times their size. Only
// the order changes, not the size or when a name appears.
const FOOTBALL_PRIORITY = new Set(["CM", "GH", "SN", "CI", "NG", "TN", "KR", "UY", "CR"]);

function minzoomForArea(km2) {
  if (km2 >= 100_000) return 0;
  if (km2 >= 50_000) return 2;
  if (km2 >= 20_000) return 2.5;
  if (km2 >= 10_000) return 3;
  if (km2 >= 2_000) return 4;
  return 5;
}

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
    const area = Math.round(areaKm2.get(code));
    const coordinates =
      LABEL_POINT[code] ?? (p ? [p.LABEL_X, p.LABEL_Y].map((n) => Math.round(n * 1000) / 1000) : innerPoint.get(code));
    return {
      type: "Feature",
      properties: {
        code,
        name: labelName(code),
        area,
        // Collision priority (symbol-sort-key): bigger first.
        priority: area * (FOOTBALL_PRIORITY.has(code) ? 4 : 1),
        // Big territories (Greenland) stay at world view.
        minzoom: minzoomForArea(area) === 0 ? 0 : minzoomForArea(area) + (p && !isDependency(p) ? 0 : 1),
        // Largest type (ranks 1–3) only for countries over 500,000 km²:
        // smaller ones at 11 px crowded each other out in Central Africa.
        symbolrank: Math.max(p ? p.LABELRANK : 6, area < 500_000 ? 4 : 0),
      },
      geometry: { type: "Point", coordinates },
    };
  }),
};

// --- 4. Write (content-hashed names) ----------------------------------------

const hashOf = (data) => createHash("sha256").update(data).digest("hex").slice(0, 10);

const countriesJson = (
  await mapshaper.applyCommands(
    `-i c.json -rename-layers countries -o t.json format=topojson quantization=${QUANTIZATION} id-field=code`,
    { "c.json": JSON.stringify(countries) }
  )
)["t.json"].toString();
const labelsJson = JSON.stringify(labels);
// ".json" endings: served as application/json, which the CDN compresses
// (an unknown ending like .topojson is sent as application/octet-stream,
// uncompressed: 900 KB instead of ~300 KB).
const countriesFile = `countries.${hashOf(countriesJson)}.topo.json`;
const labelsFile = `country-labels.${hashOf(labelsJson)}.geo.json`;

await rm(OUT_DATA, { recursive: true, force: true });
await mkdir(OUT_DATA, { recursive: true });
await writeFile(path.join(OUT_DATA, countriesFile), countriesJson);
await writeFile(path.join(OUT_DATA, labelsFile), labelsJson);

// --- 5. Glyphs: only the ranges the label names use -------------------------

const rangeStarts = new Set();
for (const f of labels.features) {
  for (const ch of f.properties.name) rangeStarts.add(Math.floor(ch.codePointAt(0) / 256) * 256);
}
const staging = path.join(CACHE, "glyphs-staging");
await rm(staging, { recursive: true, force: true });
const glyphFiles = await buildGlyphs(FONT, [...rangeStarts].sort((a, b) => a - b), staging);
const glyphHash = hashOf(
  Buffer.concat([Buffer.from(FONT), ...(await Promise.all(glyphFiles.map((f) => readFile(f))))])
);
await rm(OUT_FONTS, { recursive: true, force: true });
await mkdir(OUT_FONTS, { recursive: true });
await cp(staging, path.join(OUT_FONTS, glyphHash), { recursive: true });

// --- 6. Tell the app the new names -------------------------------------------

await writeFile(
  ASSETS_TS,
  `// Generated by scripts/build-countries.mjs — do not edit by hand.
// File names carry a hash of their content, so they can be cached forever
// (see headers() in next.config.ts).
export const COUNTRIES_URL = "/data/${countriesFile}";
export const COUNTRY_LABELS_URL = "/data/${labelsFile}";
export const GLYPHS_URL = "/fonts/${glyphHash}/{fontstack}/{range}.pbf";
export const LABEL_FONT = ${JSON.stringify(FONT)};
`
);

// --- 7. Sizes ----------------------------------------------------------------

const sizes = (data) => {
  const kb = (n) => `${Math.round(n / 1024)} KB`;
  const br = (q) => brotliCompressSync(Buffer.from(data), { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: q } }).length;
  return `${kb(Buffer.byteLength(data))} (gzip ${kb(gzipSync(data, { level: 6 }).length)}, brotli level 5 ${kb(br(5))}, level 11 ${kb(br(11))})`;
};
console.log(`${countriesFile}: ${countries.features.length} countries, ${sizes(countriesJson)}`);
console.log(`${labelsFile}: ${sizes(labelsJson)}`);
console.log(`glyphs: /fonts/${glyphHash}/${FONT}/ ranges ${[...rangeStarts].map((s) => `${s}-${s + 255}`).join(", ")}`);
console.log(`(previous files removed; ${path.relative(ROOT, ASSETS_TS)} updated)`);
