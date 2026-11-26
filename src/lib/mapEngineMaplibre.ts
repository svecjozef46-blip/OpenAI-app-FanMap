import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type mapboxgl from "mapbox-gl";
import type { MapEngine } from "@/lib/mapEngine";
import {
  COUNTRY_SOURCE_ID,
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
// in public/, made by scripts/build-countries.mjs (see docs/maplibre.md):
//   /data/countries.geojson        Natural Earth country shapes, id = ISO alpha-2
//   /data/country-labels.geojson   one label point per country
//   /fonts/Open Sans Semibold/     label glyphs
// The layers are the same as on the Mapbox map (countryLayers() in
// lib/mapSetup.ts), with the same ids and feature-state keys, so colors,
// hover and the light/dark palette work through the same code.

const LABEL_SOURCE_ID = "country-labels";
const LABEL_FONT = "Open Sans Semibold";

const ATTRIBUTION = '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>';

// MapLibre fetches these from a web worker, which can't resolve paths
// relative to the page, hence absolute URLs. (Plain concatenation, not
// new URL(): that would escape the {fontstack}/{range} placeholders.)
const asset = (path: string) => window.location.origin + path;

// Country names, styled after Mapbox dark-v11's country labels: medium
// weight, small at world view and growing with zoom. `rank` (Natural
// Earth's MIN_LABEL, ~1.7 for Russia, ~5 for Luxembourg) is roughly the
// zoom from which a name fits; names wait until a few zoom levels before
// that (dependencies later still, see
// scripts/build-countries.mjs), and bigger countries win when two collide (symbol-sort-key), as on
// Mapbox. `size` (Natural Earth's LABELRANK, 2 = largest) sets the type size.
const labelLayer: maplibregl.LayerSpecification = {
  id: LABEL_LAYER_ID,
  type: "symbol",
  source: LABEL_SOURCE_ID,
  // Like Mapbox: no names below zoom 1 (the whole world on a phone).
  minzoom: 1,
  // Up to 3 levels early at world view, 2 when zoomed in (as on Mapbox).
  filter: ["<=", ["get", "rank"], ["+", ["zoom"], ["step", ["zoom"], 3, 2.5, 2]]],
  layout: {
    "text-field": ["get", "name"],
    "text-font": [LABEL_FONT],
    "text-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      1,
      ["step", ["get", "size"], 10.5, 4, 10, 5, 9.5],
      4,
      ["step", ["get", "size"], 15, 4, 13, 5, 12],
      8,
      ["step", ["get", "size"], 21, 4, 18, 5, 16],
    ],
    "text-max-width": 6,
    "text-line-height": 1.1,
    "text-padding": 2,
    "symbol-sort-key": ["get", "rank"],
  },
  paint: {
    "text-color": MAP_PALETTE.dark.label,
    "text-halo-color": MAP_PALETTE.dark.labelHalo,
    "text-halo-width": 1,
    "text-halo-blur": 0.5,
  },
};

function buildStyle({ withHover, countryLabels }: { withHover: boolean; countryLabels: boolean }) {
  const layers = countryLayers({}, { withHover }) as unknown as maplibregl.LayerSpecification[];
  const style: maplibregl.StyleSpecification = {
    version: 8,
    // Flat world, same as Mapbox (PROJECTION in lib/mapSetup.ts).
    projection: { type: "mercator" },
    sources: {
      [COUNTRY_SOURCE_ID]: {
        type: "geojson",
        data: asset("/data/countries.geojson"),
        // ISO alpha-2 code as feature id, like `iso_3166_1` on Mapbox — the
        // format votes.country_code uses.
        promoteId: "code",
        attribution: ATTRIBUTION,
        // Shapes are already simplified at build time; keep them as they are.
        tolerance: 0.2,
      },
    },
    // No background layer: transparent oceans, the page shows through.
    layers,
  };
  if (countryLabels) {
    style.glyphs = asset("/fonts/{fontstack}/{range}.pbf");
    style.sources[LABEL_SOURCE_ID] = { type: "geojson", data: asset("/data/country-labels.geojson") };
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
      style: buildStyle({ withHover, countryLabels }),
      renderWorldCopies: false,
      bounds: WORLD_BOUNDS,
      // Resizing is handled by each component's ResizeObserver.
      trackResize: false,
      ...(interactive
        ? { dragRotate: false, pitchWithRotate: false, cooperativeGestures: Boolean(cooperativeGestures) }
        : { interactive: false }),
      attributionControl: attribution === "default" ? {} : false,
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
};
