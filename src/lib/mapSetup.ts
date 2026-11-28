import type mapboxgl from "mapbox-gl";
import type { Theme } from "@/lib/theme";

// Shared map setup used by both maps in the app: the interactive match
// map (components/GlobalMap.tsx) and the decorative home-page map
// (components/HeroMap.tsx). Kept in one place so both always look the same.
//
// The look: a flat, minimal world. Every layer of the Mapbox base style is
// hidden (roads, terrain, water, its own borders), so the oceans are
// transparent and the page background shows through — the map blends into
// the page in light and dark mode with no visible edge. Land, borders and
// team colors are our own layers, drawn from one country-boundaries tileset.

export const COUNTRY_SOURCE_ID = "country-boundaries";
export const COUNTRY_SOURCE_LAYER = "country_boundaries";
export const LAND_LAYER_ID = "country-land";
export const FILL_LAYER_ID = "country-fills";
export const BORDER_LAYER_ID = "country-borders";
export const HOVER_LAYER_ID = "country-hover";
// Country names: from the Mapbox base style, or our own layer of the same
// id in the MapLibre style (lib/mapEngineMaplibre.ts).
export const LABEL_LAYER_ID = "country-label";

// Mapbox's maintained country-boundaries tileset. `iso_3166_1` (ISO alpha-2,
// e.g. "SK") is promoted as the feature id — the same format
// votes.country_code uses, so vote data maps onto countries directly.
export const COUNTRY_TILESET_URL = "mapbox://mapbox.country-boundaries-v1";

// Only used for its country-name labels and fonts; everything else in it is
// hidden (see tidyBaseStyle).
export const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

// Flat (Mercator) world, not the 3D globe Mapbox v3 shows by default at low
// zoom — the whole point of the product is seeing every country at once.
//
// Mercator is the world people know from Google Maps, weather sites and TV
// graphics. It does inflate the far north (Canada, Russia, Greenland), and
// two alternatives were tried on 2026-11-14 and rejected by the product
// owner: Equal Earth (true areas, but a curved, squashed outline) and
// equirectangular (straight, but flattened). Familiar beat accurate here.
export const PROJECTION = "mercator";

// Rough starting view; fitWorld() below does the exact framing.
export const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-168, -56],
  [190, 75],
];

// Outermost points [lng, lat] that must stay in view. West edge: Alaska.
// East edge: longitude 190 rather than 180, so Russia's eastern tip stays
// attached to Russia instead of being cut off and shown beside Alaska.
// (MapLibre, with renderWorldCopies off, shows nothing past 180° and keeps
// the view to one world, so the tip showed beside Alaska; both MapLibre maps
// use frameWorld() below instead.)
// North: capped at 75° (Mercator stretches the empty Arctic enormously).
// South: Tierra del Fuego. Antarctica is left out entirely (also filtered
// from the layers, see WORLDVIEW_FILTER): it has no fans, and in Mercator it
// would take a large part of the frame.
const WORLD_EXTREMES: Array<[number, number]> = [
  [-168, 60],
  [190, 60],
  [0, 75],
  [-68, -55.6],
];

export type MapPadding = { top: number; bottom: number; left: number; right: number };

// Frames the whole inhabited world inside the map container, minus
// `padding` (space reserved for panels floating over the map). Mapbox's own
// fitBounds() would do for Mercator, but it only looks at the corners of a
// lng/lat box and breaks for any other projection. This measures where the
// outermost points actually land on screen and adjusts zoom and position to
// fit, so the projection can be changed in one line (PROJECTION above).
export function fitWorld(map: mapboxgl.Map, padding: MapPadding) {
  const container = map.getContainer();
  const availableWidth = container.clientWidth - padding.left - padding.right;
  const availableHeight = container.clientHeight - padding.top - padding.bottom;
  if (availableWidth <= 0 || availableHeight <= 0) return;

  const measure = () => {
    const points = WORLD_EXTREMES.map((lngLat) => map.project(lngLat));
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  };

  // 1. Zoom so the world's on-screen size matches the available space.
  let box = measure();
  const scale = Math.min(availableWidth / (box.maxX - box.minX), availableHeight / (box.maxY - box.minY));
  map.jumpTo({ zoom: map.getZoom() + Math.log2(scale) });

  // 2. Slide it so it sits centred in that space.
  box = measure();
  const offsetX = (box.minX + box.maxX) / 2 - (padding.left + availableWidth / 2);
  const offsetY = (box.minY + box.maxY) / 2 - (padding.top + availableHeight / 2);
  map.panBy([offsetX, offsetY], { animate: false });
}

// MapLibre maps (home page and match pages): exactly one world wide, from
// 169° W to 191° E. The left edge runs through the Bering Strait, between
// Alaska's western tip (168.1° W) and Russia's eastern tip, Cape Dezhnev
// (169.7° W = 190.3° E), so Alaska and Chukotka are both whole
// (scripts/build-countries.mjs keeps Chukotka joined to Russia across 180°).
// Vertically: if everything from Greenland's tip to Tierra del Fuego fits
// between the paddings, centred there; otherwise Tierra del Fuego sits
// `padding.bottom` above the bottom edge and the far north is cut off. Needs
// renderWorldCopies (what lies past 180° is drawn from the next copy of the
// world); a view exactly one world wide shows nothing twice, so the match
// map's minimum zoom is this zoom.
const WORLD_WEST_EDGE = -169;
const WORLD_NORTH = 83.7; // Greenland's northern tip
const WORLD_SOUTH = -56; // Tierra del Fuego
export function frameWorld(map: mapboxgl.Map, padding: MapPadding) {
  const container = map.getContainer();
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width <= 0 || height <= 0) return;
  const zoom = Math.log2(width / 512); // the world (512 px at zoom 0) as wide as the map
  // Web Mercator, in pixels from the top of the world at this zoom.
  const toY = (lat: number) => (0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)) * width;
  const toLat = (y: number) => (360 / Math.PI) * Math.atan(Math.exp((0.5 - y / width) * 2 * Math.PI)) - 90;
  const north = toY(WORLD_NORTH);
  const south = toY(WORLD_SOUTH);
  const available = height - padding.top - padding.bottom;
  const centreY =
    south - north <= available
      ? (north + south) / 2 - (padding.top + available / 2 - height / 2)
      : south - (height - padding.bottom - height / 2);
  map.jumpTo({ center: [WORLD_WEST_EDGE + 180, toLat(centreY)], zoom });
}

// The tileset contains several overlapping versions of disputed borders
// (one per "worldview"). Without this filter some countries are drawn
// twice and colors/hover look patchy. "US" is Mapbox's default worldview.
export const WORLDVIEW_FILTER: mapboxgl.FilterSpecification = [
  "all",
  ["==", ["get", "disputed"], "false"],
  ["!=", ["get", "iso_3166_1"], "AQ"], // no Antarctica
  ["any", ["==", "all", ["get", "worldview"]], ["in", "US", ["get", "worldview"]]],
];

// Map colors per mode. `border` equals the page background, so countries
// look like separate tiles with a hairline gap between them.
type MapPalette = {
  land: string;
  border: string;
  label: string;
  labelHalo: string;
  hover: string;
  undecided: string; // countries with a few votes but no clear leader yet
};
export const MAP_PALETTE: Record<Theme, MapPalette> = {
  dark: {
    land: "#222226",
    border: "#000000",
    label: "#a1a1a6",
    labelHalo: "rgba(0,0,0,0.6)",
    hover: "#ffffff",
    undecided: "#636366",
  },
  light: {
    land: "#d6d6dc",
    border: "#ffffff",
    label: "#6e6e73",
    labelHalo: "rgba(255,255,255,0.7)",
    hover: "#1d1d1f",
    undecided: "#9c9ca3",
  },
};

// Hides every layer of the base style (see file comment), keeping only the
// country-name labels when asked. Returns the label layer's id so our
// layers can be inserted underneath it.
export function tidyBaseStyle(map: mapboxgl.Map, { keepCountryLabels }: { keepCountryLabels: boolean }) {
  let labelLayerId: string | undefined;
  for (const layer of map.getStyle()?.layers ?? []) {
    if (keepCountryLabels && layer.id === LABEL_LAYER_ID) {
      labelLayerId = layer.id;
    } else {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
  // The base style's atmosphere would tint the transparent background.
  map.setFog(null);
  return labelLayerId;
}

// Our layers, bottom to top: land, team-color fills, borders and
// (interactive map only) the hover outline. Colors come from
// applyMapPalette(); per-country team colors from feature-state
// (`fillColor`, `lineColor`, `opacity`, `hover`), set by the map components.
// Shared by both engines (lib/mapEngine.ts): Mapbox adds them on top of its
// base style (addCountryLayers below), MapLibre builds its whole style from
// them (lib/mapEngineMaplibre.ts). `source` says where the shapes come from:
// a layer of a vector tileset (Mapbox) or a plain GeoJSON source (MapLibre).
type CountrySource = { sourceLayer?: string; filter?: mapboxgl.FilterSpecification };
export function countryLayers(
  { sourceLayer, filter }: CountrySource,
  { withHover }: { withHover: boolean }
): mapboxgl.LayerSpecification[] {
  const common = {
    source: COUNTRY_SOURCE_ID,
    ...(sourceLayer ? { "source-layer": sourceLayer } : {}),
    ...(filter ? { filter } : {}),
  } as const;

  const layers: mapboxgl.LayerSpecification[] = [
    { id: LAND_LAYER_ID, type: "fill", ...common, paint: { "fill-color": "#1c1c1e" } },
    {
      id: FILL_LAYER_ID,
      type: "fill",
      ...common,
      paint: {
        "fill-color": ["coalesce", ["feature-state", "fillColor"], "#000000"],
        // No votes → fully transparent (plain land shows). Hovering
        // brightens a colored country a little.
        "fill-opacity": [
          "*",
          ["coalesce", ["feature-state", "opacity"], 0],
          ["case", ["boolean", ["feature-state", "hover"], false], 1.15, 1],
        ],
      },
    },
    {
      id: BORDER_LAYER_ID,
      type: "line",
      ...common,
      paint: { "line-color": "#000000", "line-width": 0.7 },
    },
  ];

  if (withHover) {
    layers.push({
      id: HOVER_LAYER_ID,
      type: "line",
      ...common,
      paint: {
        "line-color": "#ffffff",
        "line-width": 1.4,
        "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0],
      },
    });
  }
  return layers;
}

// Mapbox: adds the country source and our layers underneath the base
// style's country labels (`beforeId`, from tidyBaseStyle).
export function addCountryLayers(
  map: mapboxgl.Map,
  { beforeId, withHover }: { beforeId: string | undefined; withHover: boolean }
) {
  map.addSource(COUNTRY_SOURCE_ID, {
    type: "vector",
    url: COUNTRY_TILESET_URL,
    promoteId: "iso_3166_1",
  });
  for (const layer of countryLayers({ sourceLayer: COUNTRY_SOURCE_LAYER, filter: WORLDVIEW_FILTER }, { withHover })) {
    map.addLayer(layer, beforeId);
  }
}

// Applies the light or dark palette to the layers above. Called once after
// the layers are added and again whenever the visitor switches mode — the
// map itself is never recreated for a mode change.
export function applyMapPalette(map: mapboxgl.Map, theme: Theme) {
  const palette = MAP_PALETTE[theme];
  map.setPaintProperty(LAND_LAYER_ID, "fill-color", palette.land);
  // A colored country gets a border in its team color (feature-state
  // `lineColor`), which gives the map its crisp, "lit up" look.
  map.setPaintProperty(BORDER_LAYER_ID, "line-color", ["coalesce", ["feature-state", "lineColor"], palette.border]);
  if (map.getLayer(HOVER_LAYER_ID)) {
    map.setPaintProperty(HOVER_LAYER_ID, "line-color", palette.hover);
  }
  if (map.getLayer(LABEL_LAYER_ID)) {
    map.setPaintProperty(LABEL_LAYER_ID, "text-color", palette.label);
    map.setPaintProperty(LABEL_LAYER_ID, "text-halo-color", palette.labelHalo);
  }
}

export function getMapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    console.error("NEXT_PUBLIC_MAPBOX_TOKEN is not set.");
    return null;
  }
  return token;
}

// "#RRGGBB" → rgba(), for soft team-color tints in the UI.
export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
