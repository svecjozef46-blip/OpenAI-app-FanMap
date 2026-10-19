"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { CountryResult, MatchWithTeams } from "@/lib/types";

const COUNTRY_SOURCE_ID = "country-boundaries";
const COUNTRY_SOURCE_LAYER = "country_boundaries";
const FILL_LAYER_ID = "country-fills";
const BORDER_LAYER_ID = "country-borders";

// Mapbox ships a maintained, high-detail country boundaries vector tileset
// as a public tileset — using it means we don't need to bundle, host, or
// simplify our own world GeoJSON. `iso_3166_1` (ISO 3166-1 alpha-2) is
// promoted as the feature id, which is exactly the format votes.country_code
// already uses, so no translation layer is needed between the two.
const COUNTRY_TILESET_URL = "mapbox://mapbox.country-boundaries-v1";

const NEUTRAL_FILL = "#2a2d34";

// See dev-prompt-chatgpt.md "MAP MATCH SWITCHING": "Clicking View Map
// should ONLY update... map source-layer data... must NOT... recreate the
// Mapbox instance; avoid flickering. Initialize Mapbox once, update GeoJSON
// source data on match change." We don't use a GeoJSON source here (we use
// the vector tileset above), but the same rule applies to feature-state:
// the map instance is created exactly once in the mount effect below, and
// every subsequent match/result change only calls setFeatureState — it
// never touches the map/source/layer objects themselves.
export function GlobalMap({
  match,
  results,
}: {
  match: MatchWithTeams;
  results: CountryResult[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  // Country codes we've set feature-state on, so the next update can clear
  // exactly those before applying the new match's results — otherwise a
  // country colored for the previous match would stay colored forever.
  const coloredCountriesRef = useRef<Set<string>>(new Set());
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // Mount effect: runs exactly once. Creates the Mapbox instance and adds
  // the source/layers. Never re-runs on match or results changes — see the
  // file-level comment above.
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("NEXT_PUBLIC_MAPBOX_TOKEN is not set.");
      return;
    }
    if (!containerRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [10, 25],
      zoom: 1.4,
      minZoom: 0.8,
      attributionControl: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource(COUNTRY_SOURCE_ID, {
        type: "vector",
        url: COUNTRY_TILESET_URL,
        promoteId: "iso_3166_1",
      });

      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: COUNTRY_SOURCE_ID,
        "source-layer": COUNTRY_SOURCE_LAYER,
        paint: {
          // Smooth color transitions on result change (dev-prompt-chatgpt.md
          // "premium" direction: "smooth transitions") rather than an
          // instant, jarring repaint.
          "fill-color": ["coalesce", ["feature-state", "fillColor"], NEUTRAL_FILL],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.9,
            0.75,
          ],
          "fill-opacity-transition": { duration: 400 },
        },
      });

      map.addLayer({
        id: BORDER_LAYER_ID,
        type: "line",
        source: COUNTRY_SOURCE_ID,
        "source-layer": COUNTRY_SOURCE_LAYER,
        paint: {
          "line-color": "#60646c",
          "line-width": 0.5,
        },
      });

      loadedRef.current = true;
      // The results-sync effect below runs before `load` fires (it depends
      // on `results`, which is already set on first render), so it bails
      // out via loadedRef being false. Re-run it once here so the initial
      // match's results actually get painted.
      applyResults();
    });

    let hoveredId: string | number | null = null;
    popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });

    map.on("mousemove", FILL_LAYER_ID, (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: COUNTRY_SOURCE_ID, sourceLayer: COUNTRY_SOURCE_LAYER, id: hoveredId },
          { hover: false }
        );
      }
      hoveredId = feature.id ?? null;
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: COUNTRY_SOURCE_ID, sourceLayer: COUNTRY_SOURCE_LAYER, id: hoveredId },
          { hover: true }
        );
      }

      const countryName = (feature.properties?.name_en as string | undefined) ?? "Unknown";
      const resultsForCountry = resultsRef.current.find(
        (r) => r.countryCode === String(feature.id)
      );
      const home = resultsForCountry?.homeVotes ?? 0;
      const away = resultsForCountry?.awayVotes ?? 0;
      const total = home + away;
      const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div style="font:13px system-ui;color:#18181b">
             <strong>${countryName}</strong><br/>
             ${matchRef.current.home_team.short_name} ${pct(home)}% · ${matchRef.current.away_team.short_name} ${pct(away)}%<br/>
             <span style="color:#71717a">${total} vote${total === 1 ? "" : "s"}</span>
           </div>`
        )
        .addTo(map);
    });

    map.on("mouseleave", FILL_LAYER_ID, () => {
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: COUNTRY_SOURCE_ID, sourceLayer: COUNTRY_SOURCE_LAYER, id: hoveredId },
          { hover: false }
        );
        hoveredId = null;
      }
      popupRef.current?.remove();
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // Intentionally empty dependency array — see file-level comment.
  }, []);

  // Refs mirroring the latest props, so the stable event handlers created
  // in the mount effect above (which must not be recreated — that's the
  // whole point) can still read current data instead of stale closures.
  const matchRef = useRef(match);
  matchRef.current = match;
  const resultsRef = useRef(results);
  resultsRef.current = results;

  function applyResults() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    for (const code of coloredCountriesRef.current) {
      map.setFeatureState(
        { source: COUNTRY_SOURCE_ID, sourceLayer: COUNTRY_SOURCE_LAYER, id: code },
        { fillColor: null }
      );
    }
    coloredCountriesRef.current = new Set();

    for (const result of resultsRef.current) {
      if (!result.leadingTeamId) continue;
      const color =
        result.leadingTeamId === matchRef.current.home_team_id
          ? matchRef.current.home_team.primary_color
          : matchRef.current.away_team.primary_color;
      map.setFeatureState(
        {
          source: COUNTRY_SOURCE_ID,
          sourceLayer: COUNTRY_SOURCE_LAYER,
          id: result.countryCode,
        },
        { fillColor: color }
      );
      coloredCountriesRef.current.add(result.countryCode);
    }
  }

  // Results-sync effect: fires on every match switch and every new vote.
  // Only ever calls setFeatureState — see the file-level comment at the top
  // of this component for why that matters.
  useEffect(() => {
    applyResults();
  }, [match.id, results]);

  return <div ref={containerRef} className="h-full w-full" />;
}
