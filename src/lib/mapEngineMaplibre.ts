import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type mapboxgl from "mapbox-gl";
import type { MapEngine } from "@/lib/mapEngine";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { COUNTRIES_URL, COUNTRY_LABELS_URL, GLYPHS_URL, LABEL_FONT } from "@/lib/mapAssets";
import {
  BORDER_LAYER_ID,
  COUNTRY_SOURCE_ID,
  HOVER_LAYER_ID,
  LABEL_LAYER_ID,
  MAP_PALETTE,
  WORLD_BOUNDS,
  applyMapPalette,
  countryLayers,
} from "@/lib/mapSetup";

// MapLibre GL JS engine (NEXT_PUBLIC_MAP_ENGINE=maplibre, see
// lib/mapEngine.ts). Loaded only when selected, so Mapbox builds never ship
// it.
//
// No base style and no outside server: the style is built here from files
// in public/, made by scripts/build-countries.mjs (see docs/maplibre.md),
// whose current names are in lib/mapAssets.ts:
//   /data/countries.<hash>.topo.json      Natural Earth country shapes, id = ISO alpha-2
//   /data/country-labels.<hash>.geo.json  one label point per country
//   /fonts/<hash>/<font>/<range>.pbf      label glyphs
// The layers are the same as on the Mapbox map (countryLayers() in
// lib/mapSetup.ts), with the same ids and feature-state keys, so colors,
// hover and the light/dark palette work through the same code.

const LABEL_SOURCE_ID = "country-labels";
// Home-page map only: a second copy of the country shapes for the borders
// (see `outline` in lib/mapEngine.ts). MapLibre redoes every layer that
// reads a feature's state whenever any of its state changes; the light-up
// animation changes a country's fill every frame but its border only once,
// so with one shared source the borders (the layer with the most vertices)
// were recomputed every frame for nothing. Measured: with the finer shapes
// below, the animation's JavaScript per frame on a 4× slowed CPU went from
// ~8–10 ms back to ~5 ms, as with the old coarse shapes. The match map
// changes colors only now and then, and there the second copy would only
// delay the first picture (~0.5 s in our measurements), so it has none.
const OUTLINE_SOURCE_ID = "country-outlines";

// How much MapLibre may simplify the shapes when it cuts them into tiles
// (Douglas–Peucker, in pixels of a 512 px tile; MapLibre's default is
// 0.375). Measured with docs/maplibre-comparison/tools/shape-fidelity.cjs:
// a drawn coastline must stay within 1 screen pixel of the real one. The
// default is in CSS pixels, so on a screen with 2 or 3 device pixels per CSS
// pixel the same simplification is 2–3× more visible; and tiles are shown up
// to 2× enlarged between zoom levels. 0.125 per device pixel keeps every
// tested window (390–3840 px wide, DPR 1–3) within 1 px (0.1875 just
// missed on a 3840 px window at 2×); the default was up to 2 px off, the
// home page's former 1.5 up to 7 px.
const SHAPE_TOLERANCE = 0.125;
// Development only (left out of production builds): measurement scripts
// can draw the maps with other settings to compare, e.g. the tolerance before
// a change (docs/maplibre-comparison/tools/shape-fidelity.cjs --exp=…).
type DevOverrides = { hero?: object; match?: object; map?: object };
function devOverrides(): DevOverrides | undefined {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return undefined;
  return (window as unknown as { __fanmapMapOptions?: DevOverrides }).__fanmapMapOptions;
}

function shapeTolerance(): number {
  const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return SHAPE_TOLERANCE / Math.max(1, ratio);
}

// Our shapes are good to about zoom 7 (Luxembourg filling a laptop screen);
// beyond that Natural Earth's coastlines look coarse next to Mapbox's, and
// nobody needs street-level zoom on a fan map. See docs/maplibre.md.
export const MAPLIBRE_MAX_ZOOM = 7;

const ATTRIBUTION =
  '<a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre</a> | ' +
  '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>';

// MapLibre fetches glyphs itself, from absolute URLs. (Plain
// concatenation, not new URL(): that would escape the {fontstack}/{range}
// placeholders.)
const asset = (path: string) => window.location.origin + path;

// Country shapes and label points, fetched once per page load and shared by
// every map on it (the home-page map, then the match map after navigating
// there). The files are cached by the browser for a year (their names
// change with their content), and the page asks for them early with
// <link rel="preload"> (preloadMapData in lib/mapEngine.ts), which this
// plain fetch() picks up. The shapes arrive as compact TopoJSON and are
// turned into the GeoJSON MapLibre draws.
//
// MapLibre cuts the shapes into tiles in a web worker. Handing it the
// GeoJSON as an object means copying ~110,000 points to the worker on the
// main thread (~100 ms, several times that on a phone). Instead the GeoJSON
// becomes text in a blob: URL, which the worker fetches and parses itself.
type CountryData = { countriesUrl: string; labels: GeoJSON.FeatureCollection };
let countryData: CountryData | null = null;
let loadingData: Promise<CountryData> | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

// TopoJSON decodes to long fractions (12.345678901…); 4 decimals (~10 m)
// is far below what the map shows and halves the text handed to the worker.
function roundCoordinates(collection: GeoJSON.FeatureCollection) {
  const round = (ring: number[][]) => {
    for (const point of ring) {
      point[0] = Math.round(point[0] * 1e4) / 1e4;
      point[1] = Math.round(point[1] * 1e4) / 1e4;
    }
  };
  for (const f of collection.features) {
    const g = f.geometry;
    if (g.type === "Polygon") g.coordinates.forEach(round);
    else if (g.type === "MultiPolygon") g.coordinates.forEach((polygon) => polygon.forEach(round));
  }
}

export function loadCountryData(): Promise<CountryData> {
  loadingData ??= Promise.all([fetchJson<Topology>(COUNTRIES_URL), fetchJson<GeoJSON.FeatureCollection>(COUNTRY_LABELS_URL)])
    .then(([topology, labels]) => {
      const countries = feature(topology, topology.objects.countries) as GeoJSON.FeatureCollection;
      roundCoordinates(countries);
      const blob = new Blob([JSON.stringify(countries)], { type: "application/json" });
      countryData = { countriesUrl: URL.createObjectURL(blob), labels };
      return countryData;
    })
    .catch((error) => {
      loadingData = null; // let a later map try again
      throw error;
    });
  return loadingData;
}

// Country names, mirroring Mapbox dark-v11's `country-label` layer (read
// from the style our Mapbox map loads): no capitals, no letter spacing,
// 11 / 9 / 8 px at zoom 1 by `symbolrank` growing to 22 / 19 / 17 px at
// zoom 9 on the same curve, max width 6 em, line height 1.1, halo 1.25, radial offset 0.6.
// Font: see LABEL_FONT in lib/mapAssets.ts.
// Our data adds what Mapbox's tiles decide on their side (see
// scripts/build-countries.mjs): `minzoom` from the country's area (bigger
// countries are named at world view, the smallest only zoomed in) and, when
// names collide, the bigger country wins (`priority` as symbol-sort-key:
// the area, raised for a few football countries in crowded regions).
// Where a name doesn't fit on its point, it may move just next to it (above,
// below, to a side), as Mapbox's labels do: at world view that names 94
// countries instead of 67 (measured on a 1440×900 screen, 2026-11-26;
// docs/maplibre-comparison/tools/labels.cjs).
const labelLayer: maplibregl.LayerSpecification = {
  id: LABEL_LAYER_ID,
  type: "symbol",
  source: LABEL_SOURCE_ID,
  // Mapbox starts at 1; 0.75 so a 1280×720 laptop, whose whole world sits
  // at zoom ~0.9, still gets names. Phones (zoom below 0) get none, as on
  // Mapbox.
  minzoom: 0.75,
  filter: [">=", ["zoom"], ["get", "minzoom"]],
  layout: {
    "text-field": ["get", "name"],
    "text-font": [LABEL_FONT],
    "text-size": [
      "interpolate",
      ["cubic-bezier", 0.2, 0, 0.7, 1],
      ["zoom"],
      1,
      ["step", ["get", "symbolrank"], 11, 4, 9, 5, 8],
      9,
      ["step", ["get", "symbolrank"], 22, 4, 19, 5, 17],
    ],
    "text-max-width": 6,
    "text-line-height": 1.1,
    "text-padding": 0,
    "text-variable-anchor": ["center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"],
    "text-radial-offset": 0.5,
    "symbol-sort-key": ["-", 0, ["get", "priority"]],
  },
  paint: {
    "text-color": MAP_PALETTE.dark.label,
    "text-halo-color": MAP_PALETTE.dark.labelHalo,
    "text-halo-width": 1.25,
  },
};

function buildStyle({
  withHover,
  countryLabels,
  interactive,
}: {
  withHover: boolean;
  countryLabels: boolean;
  interactive: boolean;
}) {
  if (!countryData) throw new Error("loadCountryData() must finish before a map is created");
  const splitOutlines = !interactive;
  const layers = (countryLayers({}, { withHover }) as unknown as maplibregl.LayerSpecification[]).map((layer) =>
    splitOutlines && (layer.id === BORDER_LAYER_ID || layer.id === HOVER_LAYER_ID)
      ? { ...layer, source: OUTLINE_SOURCE_ID }
      : layer
  );
  const shapes = {
    type: "geojson",
    data: countryData.countriesUrl,
    // ISO alpha-2 code as feature id, like `iso_3166_1` on Mapbox — the
    // format votes.country_code uses.
    promoteId: "code",
    tolerance: shapeTolerance(),
    // Home-page map (fixed world view): no tiles past zoom 3, as it never
    // zooms in.
    ...(interactive ? {} : { maxzoom: 3 }),
    ...devOverrides()?.[interactive ? "match" : "hero"],
  } satisfies maplibregl.GeoJSONSourceSpecification;
  const style: maplibregl.StyleSpecification = {
    version: 8,
    // Flat world, same as Mapbox (PROJECTION in lib/mapSetup.ts).
    projection: { type: "mercator" },
    sources: {
      [COUNTRY_SOURCE_ID]: { ...shapes, attribution: ATTRIBUTION },
      ...(splitOutlines ? { [OUTLINE_SOURCE_ID]: shapes } : {}),
    },
    // No background layer: transparent oceans, the page shows through.
    layers,
  };
  if (countryLabels) {
    style.glyphs = asset(GLYPHS_URL);
    style.sources[LABEL_SOURCE_ID] = {
      type: "geojson",
      data: countryData.labels,
      // No tile buffer: with one, a label point near a tile edge (the
      // equator and the Greenwich meridian at world zoom) is copied into
      // both tiles, and with symbol-sort-key one copy knocks out the other,
      // so names like Tanzania, Ecuador or the United Kingdom disappeared.
      buffer: 0,
    };
    style.layers.push(labelLayer);
  }
  return style;
}

export const maplibreEngine: MapEngine = {
  name: "maplibre",
  countsMapLoads: false, // nothing is billed
  isConfigured: () => true,

  createMap({ container, interactive, attribution, cooperativeGestures, withHover, countryLabels }) {
    const map = new maplibregl.Map({
      container,
      style: buildStyle({ withHover, countryLabels, interactive }),
      renderWorldCopies: false,
      bounds: WORLD_BOUNDS,
      maxZoom: MAPLIBRE_MAX_ZOOM,
      // Resizing is handled by each component's ResizeObserver.
      trackResize: false,
      ...(interactive
        ? { dragRotate: false, pitchWithRotate: false, cooperativeGestures: Boolean(cooperativeGestures) }
        : { interactive: false }),
      attributionControl: attribution === "default" ? {} : false,
      // MapLibre draws at most 4096 × 4096 device pixels by default and
      // stretches the picture beyond that, which blurs the map on a 5K
      // display (2560 × 1440 at 2×: 5120 px wide). Mapbox has no such limit.
      // MapLibre still lowers it on its own if the graphics card can't go
      // this far.
      maxCanvasSize: [8192, 8192],
      ...devOverrides()?.map,
    });
    if (attribution === "compact") {
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    }
    // A compact attribution (phones, and the home-page map) starts expanded
    // in MapLibre, laying "Natural Earth" over the map; Mapbox starts it
    // folded to the (i) button. Fold it the same way.
    map.once("load", () => {
      container.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
    });
    return map as unknown as mapboxgl.Map;
  },

  Popup: maplibregl.Popup as unknown as typeof mapboxgl.Popup,
  NavigationControl: maplibregl.NavigationControl as unknown as typeof mapboxgl.NavigationControl,

  // Sources and layers are already in the style (buildStyle), so "load"
  // only fires once the shapes are in; just set the colors.
  setupLayers(map, { theme }) {
    applyMapPalette(map, theme);
  },

  // GeoJSON sources have no source layers.
  country: (id) => ({ source: COUNTRY_SOURCE_ID, id }),
  outline: (map, id) => ({ source: map.getSource(OUTLINE_SOURCE_ID) ? OUTLINE_SOURCE_ID : COUNTRY_SOURCE_ID, id }),
};
