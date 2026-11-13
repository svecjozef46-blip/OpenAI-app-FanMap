import type mapboxgl from "mapbox-gl";

// Shared Mapbox setup used by both maps in the app: the interactive match
// map (components/GlobalMap.tsx) and the decorative landing-page map
// (components/HeroMap.tsx). Kept in one place so both always look the same.

export const COUNTRY_SOURCE_ID = "country-boundaries";
export const COUNTRY_SOURCE_LAYER = "country_boundaries";
export const FILL_LAYER_ID = "country-fills";
export const HOVER_LAYER_ID = "country-hover";
export const BORDER_LAYER_ID = "country-borders";

// Mapbox's maintained country-boundaries tileset. `iso_3166_1` (ISO alpha-2,
// e.g. "SK") is promoted as the feature id — the same format
// votes.country_code uses, so vote data maps onto countries directly.
export const COUNTRY_TILESET_URL = "mapbox://mapbox.country-boundaries-v1";

export const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

// Flat (Mercator) world, not the 3D globe Mapbox v3 shows by default at
// low zoom — the whole point of the product is seeing every country at
// once. Latitudes are trimmed (no Antarctica, little Arctic) so the
// inhabited world fills the frame instead of vast empty poles.
export const PROJECTION = "mercator";
export const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-168, -56],
  [190, 75],
];

// The tileset contains several overlapping versions of disputed borders
// (one per "worldview"). Without this filter some countries are drawn
// twice and colors/hover look patchy. "US" is Mapbox's default worldview.
export const WORLDVIEW_FILTER: mapboxgl.FilterSpecification = [
  "all",
  ["==", ["get", "disputed"], "false"],
  ["any", ["==", "all", ["get", "worldview"]], ["in", "US", ["get", "worldview"]]],
];

// Hides the dark-v11 style's ocean/place/road labels so team colors are
// the focus, keeping only country names (dimmed). Returns the id of the
// first remaining label layer so our fills can be inserted underneath it
// (labels stay readable on top of colored countries).
export function tidyBaseStyle(map: mapboxgl.Map, { keepCountryLabels }: { keepCountryLabels: boolean }) {
  let firstLabelLayerId: string | undefined;
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== "symbol") continue;
    if (keepCountryLabels && layer.id === "country-label") {
      map.setPaintProperty(layer.id, "text-opacity", 0.55);
      firstLabelLayerId ??= layer.id;
    } else {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
  return firstLabelLayerId;
}

// Thin country borders. The dark base style's land and water are very
// close in color; without these, uncolored countries blend into the ocean.
// A colored country gets a brighter border in its team color (feature-state
// `lineColor`), which gives the map its crisp, "lit up" look.
export function addCountryBorders(map: mapboxgl.Map, beforeId: string | undefined) {
  map.addLayer(
    {
      id: BORDER_LAYER_ID,
      type: "line",
      source: COUNTRY_SOURCE_ID,
      "source-layer": COUNTRY_SOURCE_LAYER,
      filter: WORLDVIEW_FILTER,
      paint: {
        "line-color": ["coalesce", ["feature-state", "lineColor"], "#52525b"],
        "line-width": ["case", ["!=", ["feature-state", "lineColor"], null], 0.9, 0.6],
        "line-opacity": ["case", ["!=", ["feature-state", "lineColor"], null], 0.95, 0.8],
      },
    },
    beforeId
  );
}

export function getMapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    console.error("NEXT_PUBLIC_MAPBOX_TOKEN is not set.");
    return null;
  }
  return token;
}

// Converts "#RRGGBB" to rgba() — Mapbox's feature-state colors can't take
// a separate alpha, and we want hover/strength handled via fill-opacity
// anyway, so this is only used for UI glows.
export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
