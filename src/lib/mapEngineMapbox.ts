import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapEngine } from "@/lib/mapEngine";
import {
  COUNTRY_SOURCE_ID,
  COUNTRY_SOURCE_LAYER,
  MAP_STYLE,
  PROJECTION,
  WORLD_BOUNDS,
  addCountryLayers,
  applyMapPalette,
  getMapboxToken,
  tidyBaseStyle,
} from "@/lib/mapSetup";

// Mapbox GL JS, the default engine (see lib/mapEngine.ts). Loaded only when
// NEXT_PUBLIC_MAP_ENGINE is not "maplibre". The map is set up exactly as
// before the engine switch existed: Mapbox's dark-v11 style with everything
// but the country names hidden, plus our layers from Mapbox's
// country-boundaries tileset (lib/mapSetup.ts).
export const mapboxEngine: MapEngine = {
  name: "mapbox",
  countsMapLoads: true,
  isConfigured: () => Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN),

  createMap({ container, interactive, attribution, cooperativeGestures }) {
    mapboxgl.accessToken = getMapboxToken() ?? "";
    const map = new mapboxgl.Map({
      container,
      style: MAP_STYLE,
      projection: PROJECTION,
      renderWorldCopies: false,
      bounds: WORLD_BOUNDS,
      // Resizing is handled by each component's ResizeObserver.
      trackResize: false,
      ...(interactive
        ? { dragRotate: false, pitchWithRotate: false, cooperativeGestures }
        : { interactive: false }),
      attributionControl: attribution === "default",
    });
    if (attribution === "compact") {
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    }
    return map;
  },

  Popup: mapboxgl.Popup,
  NavigationControl: mapboxgl.NavigationControl,

  setupLayers(map, { withHover, countryLabels, theme }) {
    const beforeId = tidyBaseStyle(map, { keepCountryLabels: countryLabels });
    addCountryLayers(map, { beforeId, withHover });
    applyMapPalette(map, theme);
  },

  country: (id) => ({ source: COUNTRY_SOURCE_ID, sourceLayer: COUNTRY_SOURCE_LAYER, id }),
};
