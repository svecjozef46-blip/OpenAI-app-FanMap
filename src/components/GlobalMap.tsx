"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { CountryResult, MatchWithTeams } from "@/lib/types";
import { countryName, splitPercent } from "@/lib/format";
import { getMatchColors } from "@/lib/teamColors";
import {
  COUNTRY_SOURCE_ID,
  COUNTRY_SOURCE_LAYER,
  COUNTRY_TILESET_URL,
  FILL_LAYER_ID,
  HOVER_LAYER_ID,
  MAP_STYLE,
  PROJECTION,
  WORLDVIEW_FILTER,
  WORLD_BOUNDS,
  addCountryBorders,
  getMapboxToken,
  tidyBaseStyle,
} from "@/lib/mapSetup";

// Countries with some votes, but not enough to call (see MIN_VOTES_TO_COLOR
// in lib/results.ts) or a tie: shown in a quiet grey so people can see
// "there's activity here" without the map claiming a winner.
const UNDECIDED_COLOR = "#71717a";
const UNDECIDED_OPACITY = 0.35;

// Fill opacity for a decided country scales with how clear the lead is:
// 51% → faint, 100% → strong. Makes the map more honest (a 51/49 country
// shouldn't look the same as a 95/5 one) and more interesting to read.
function opacityForShare(leaderShare: number): number {
  return 0.4 + Math.min(Math.max(leaderShare - 0.5, 0), 0.5) * 0.9;
}

// Per dev-prompt-chatgpt.md "MAP MATCH SWITCHING": the Mapbox instance is
// created exactly once (mount effect below). Match switches and new votes
// only call setFeatureState — the map, source and layers are never
// recreated, which is what prevents flicker when switching matches.
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
  // Countries we've colored, so the next update can clear exactly those
  // first — otherwise a country colored for the previous match would stay.
  const coloredCountriesRef = useRef<Set<string>>(new Set());

  // The mount effect owns applyResults (it needs the map instance); this
  // ref lets the last effect below call it on every match switch / new vote.
  const applyResultsRef = useRef<(() => void) | null>(null);

  // Latest props for the event handlers created once in the mount effect.
  const matchRef = useRef(match);
  const resultsRef = useRef(results);
  useEffect(() => {
    matchRef.current = match;
    resultsRef.current = results;
  });

  useEffect(() => {
    const token = getMapboxToken();
    const container = containerRef.current;
    if (!token || !container) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container,
      style: MAP_STYLE,
      projection: PROJECTION,
      renderWorldCopies: false,
      bounds: WORLD_BOUNDS,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: true,
      // Resizing is handled by the ResizeObserver below. Mapbox's own
      // window-resize handling tags its camera events like user input,
      // which would make fitWorld() think the visitor had moved the map.
      trackResize: false,
      // On phones the map sits inside a scrolling page: one finger scrolls
      // the page, two fingers move the map (Mapbox shows a hint).
      cooperativeGestures: window.matchMedia("(max-width: 767px)").matches,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    // Re-fit the whole world whenever the container changes size (sidebar
    // opened/closed, window resized) — unless the visitor has zoomed or
    // panned on purpose, in which case we leave their view alone.
    let userMoved = false;
    map.on("movestart", (e) => {
      if ((e as { originalEvent?: Event }).originalEvent) userMoved = true;
    });
    function fitWorld() {
      map.resize();
      if (userMoved) return;
      const wide = window.matchMedia("(min-width: 768px)").matches;
      // On desktop the slim match header floats over the top of the map.
      const padding = wide ? { top: 84, bottom: 16, left: 16, right: 16 } : 8;
      // Reset first: a minZoom left over from a previous (bigger) size
      // would otherwise stop the map from zooming out to fit.
      map.setMinZoom(0);
      map.fitBounds(WORLD_BOUNDS, { padding, animate: false });
      map.setMinZoom(Math.max(map.getZoom() - 0.3, 0));
    }
    const resizeObserver = new ResizeObserver(() => fitWorld());
    resizeObserver.observe(container);

    map.on("load", () => {
      const beforeId = tidyBaseStyle(map, { keepCountryLabels: true });

      map.addSource(COUNTRY_SOURCE_ID, {
        type: "vector",
        url: COUNTRY_TILESET_URL,
        promoteId: "iso_3166_1",
      });

      map.addLayer(
        {
          id: FILL_LAYER_ID,
          type: "fill",
          source: COUNTRY_SOURCE_ID,
          "source-layer": COUNTRY_SOURCE_LAYER,
          filter: WORLDVIEW_FILTER,
          paint: {
            "fill-color": ["coalesce", ["feature-state", "fillColor"], UNDECIDED_COLOR],
            // Countries without votes stay transparent (the dark base map
            // shows through); hovering brightens a colored country a bit.
            "fill-opacity": [
              "*",
              ["coalesce", ["feature-state", "opacity"], 0],
              ["case", ["boolean", ["feature-state", "hover"], false], 1.2, 1],
            ],
          },
        },
        beforeId
      );

      addCountryBorders(map, beforeId);

      map.addLayer(
        {
          id: HOVER_LAYER_ID,
          type: "line",
          source: COUNTRY_SOURCE_ID,
          "source-layer": COUNTRY_SOURCE_LAYER,
          filter: WORLDVIEW_FILTER,
          paint: {
            "line-color": "#ffffff",
            "line-width": 1.2,
            "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.85, 0],
          },
        },
        beforeId
      );

      loadedRef.current = true;
      applyResults();
    });

    // Hover: outline + dark tooltip (styled in globals.css, .fanmap-popup).
    let hoveredId: string | number | null = null;
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "fanmap-popup",
      offset: 12,
    });

    function setHover(id: string | number | null, hover: boolean) {
      if (id === null) return;
      map.setFeatureState(
        { source: COUNTRY_SOURCE_ID, sourceLayer: COUNTRY_SOURCE_LAYER, id },
        { hover }
      );
    }

    map.on("mousemove", FILL_LAYER_ID, (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      if (feature.id !== hoveredId) {
        setHover(hoveredId, false);
        hoveredId = feature.id ?? null;
        setHover(hoveredId, true);
      }
      map.getCanvas().style.cursor = "default";

      const code = String(feature.id);
      const m = matchRef.current;
      const colors = getMatchColors(m);
      const r = resultsRef.current.find((x) => x.countryCode === code);
      const { homePct, awayPct, total } = splitPercent(r?.homeVotes ?? 0, r?.awayVotes ?? 0);
      const body =
        total === 0
          ? `<div class="fanmap-popup__muted">No votes yet</div>`
          : `<div class="fanmap-popup__row"><span class="fanmap-popup__dot" style="background:${colors.home}"></span>${m.home_team.short_name}<b>${homePct}%</b></div>
             <div class="fanmap-popup__row"><span class="fanmap-popup__dot" style="background:${colors.away}"></span>${m.away_team.short_name}<b>${awayPct}%</b></div>
             <div class="fanmap-popup__muted">${total.toLocaleString("en-US")} vote${total === 1 ? "" : "s"}</div>`;
      popup
        .setLngLat(e.lngLat)
        .setHTML(`<div class="fanmap-popup__title">${countryName(code)}</div>${body}`)
        .addTo(map);
    });

    map.on("mouseleave", FILL_LAYER_ID, () => {
      setHover(hoveredId, false);
      hoveredId = null;
      popup.remove();
    });

    function applyResults() {
      if (!loadedRef.current) return;
      const colors = getMatchColors(matchRef.current);
      const m = matchRef.current;

      for (const code of coloredCountriesRef.current) {
        map.setFeatureState(
          { source: COUNTRY_SOURCE_ID, sourceLayer: COUNTRY_SOURCE_LAYER, id: code },
          { fillColor: null, lineColor: null, opacity: 0 }
        );
      }
      coloredCountriesRef.current = new Set();

      for (const r of resultsRef.current) {
        if (r.totalVotes === 0) continue;
        let state: { fillColor: string; lineColor: string | null; opacity: number };
        if (!r.leadingTeamId) {
          state = { fillColor: UNDECIDED_COLOR, lineColor: null, opacity: UNDECIDED_OPACITY };
        } else {
          const homeLeads = r.leadingTeamId === m.home_team_id;
          const leaderVotes = homeLeads ? r.homeVotes : r.awayVotes;
          const color = homeLeads ? colors.home : colors.away;
          state = { fillColor: color, lineColor: color, opacity: opacityForShare(leaderVotes / r.totalVotes) };
        }
        map.setFeatureState(
          { source: COUNTRY_SOURCE_ID, sourceLayer: COUNTRY_SOURCE_LAYER, id: r.countryCode },
          state
        );
        coloredCountriesRef.current.add(r.countryCode);
      }
    }
    applyResultsRef.current = applyResults;

    return () => {
      resizeObserver.disconnect();
      popup.remove();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
      applyResultsRef.current = null;
    };
    // Intentionally empty: the map is created once — see comment above.
  }, []);

  useEffect(() => {
    applyResultsRef.current?.();
  }, [match.id, results]);

  return <div ref={containerRef} className="h-full w-full" />;
}
