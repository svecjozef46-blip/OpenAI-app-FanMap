import type mapboxgl from "mapbox-gl";
import { preload } from "react-dom";
import type { Theme } from "@/lib/theme";
import { COUNTRIES_URL, COUNTRY_LABELS_URL, GLYPHS_URL, LABEL_FONT } from "@/lib/mapAssets";

// Which map library draws the maps (GlobalMap, HeroMap). One build-time
// switch, NEXT_PUBLIC_MAP_ENGINE:
//
//   unset / "maplibre"  MapLibre GL JS (the default since 2026-11-26), the
//                       open-source fork of Mapbox GL JS. No account, token or
//                       fee: the country shapes, labels and font come from
//                       public/ (scripts/build-countries.mjs).
//   "mapbox"            Mapbox GL JS, kept as a fallback for now. Every start
//                       is billed above 50,000 a month, hence the map budget
//                       in lib/mapBudget.ts.
//
// next.config.ts always inlines the value at build time, so the other
// engine's code is left out of the build entirely: each engine lives in its
// own module, loaded with import() only when it's the one in use.
export type MapEngineName = "mapbox" | "maplibre";
export const MAP_ENGINE: MapEngineName = process.env.NEXT_PUBLIC_MAP_ENGINE === "mapbox" ? "mapbox" : "maplibre";

// Options the components choose; the engine adds the shared look (style,
// projection, starting bounds, no world copies, no automatic resize).
export type CreateMapOptions = {
  container: HTMLElement;
  interactive: boolean;
  attribution: "default" | "compact";
  cooperativeGestures?: boolean;
  // Which of our layers this map needs (see addCountryLayers in mapSetup.ts).
  withHover: boolean;
  countryLabels: boolean;
};

// Identifies one country for setFeatureState().
export type CountryFeature = { source: string; sourceLayer?: string; id: string | number };

export type MapEngine = {
  name: MapEngineName;
  // Whether each start has to be counted against the monthly budget
  // (claimMapLoad). Only Mapbox bills per start.
  countsMapLoads: boolean;
  // False when the engine can't run at all (Mapbox without a token).
  isConfigured(): boolean;
  // Both libraries share the API these components use (MapLibre was forked
  // from Mapbox GL JS and kept it), so the map, popup and controls are typed
  // as Mapbox's to keep a single code path in the components.
  createMap(options: CreateMapOptions): mapboxgl.Map;
  Popup: typeof mapboxgl.Popup;
  NavigationControl: typeof mapboxgl.NavigationControl;
  // Call from the map's "load" event: adds (or, for MapLibre, finishes) the
  // country layers and applies the light/dark palette.
  setupLayers(map: mapboxgl.Map, options: { withHover: boolean; countryLabels: boolean; theme: Theme }): void;
  country(id: string | number): CountryFeature;
  // Where a country's border state (`lineColor`) lives on this map. On the
  // MapLibre home-page map (created with `interactive: false`) the borders
  // are drawn from a second copy of the shapes, so that the light-up
  // animation, which changes each fill every frame, doesn't make the map
  // recompute every border too; there, set the border only when it changes.
  // Everywhere else it's the same feature as country().
  outline(map: mapboxgl.Map, id: string | number): CountryFeature;
};

let loading: Promise<MapEngine> | null = null;

// Resolves once the engine can draw: its code is loaded and, for MapLibre,
// the country shapes too (so a map never starts empty and fills in later).
export function loadMapEngine(): Promise<MapEngine> {
  loading ??=
    MAP_ENGINE === "maplibre"
      ? import("@/lib/mapEngineMaplibre").then((m) => m.loadCountryData().then(() => m.maplibreEngine))
      : import("@/lib/mapEngineMapbox").then((m) => m.mapboxEngine);
  loading.catch(() => {
    loading = null; // a later map (e.g. after navigating) tries again
  });
  return loading;
}

// Call while rendering a component that shows a map right away: adds
// <link rel="preload"> for MapLibre's data to the page, so the browser
// starts downloading it with the page instead of after the map's code has
// loaded. Same request mode as the fetch() that uses it (cors, same-origin
// credentials), so the preloaded response is reused. Glyphs only where
// country names are shown.
export function preloadMapData({ labels }: { labels: boolean }) {
  if (MAP_ENGINE !== "maplibre") return;
  preload(COUNTRIES_URL, { as: "fetch", crossOrigin: "anonymous" });
  if (labels) {
    preload(COUNTRY_LABELS_URL, { as: "fetch", crossOrigin: "anonymous" });
    const glyphs = GLYPHS_URL.replace("{fontstack}", encodeURIComponent(LABEL_FONT)).replace("{range}", "0-255");
    preload(glyphs, { as: "fetch", crossOrigin: "anonymous" });
  }
}

// Synchronous check for first render, before the engine module is loaded.
export function isMapEngineConfigured(): boolean {
  return MAP_ENGINE === "maplibre" || Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
}
