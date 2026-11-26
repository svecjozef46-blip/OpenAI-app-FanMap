"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { CountryResult, MatchWithTeams } from "@/lib/types";
import { countryName, splitPercent } from "@/lib/format";
import { getMatchColors } from "@/lib/teamColors";
import { useTheme } from "@/lib/theme";
import {
  COUNTRY_SOURCE_ID,
  COUNTRY_SOURCE_LAYER,
  FILL_LAYER_ID,
  MAP_PALETTE,
  MAP_STYLE,
  PROJECTION,
  WORLD_BOUNDS,
  addCountryLayers,
  applyMapPalette,
  fitWorld,
  getMapboxToken,
  tidyBaseStyle,
} from "@/lib/mapSetup";
import { claimMapLoad, useMapBudget } from "@/lib/mapBudget";
import { formatResetDate } from "@/lib/mapBudgetMessage";

// Countries with some votes, but not enough to call (see MIN_VOTES_TO_COLOR
// in lib/results.ts) or a tie: shown in a quiet grey (MAP_PALETTE.undecided)
// so people can see "there's activity here" without the map claiming a
// winner.
const UNDECIDED_OPACITY = 0.55;

// Fill opacity for a decided country scales with how clear the lead is:
// 51% → faint, 100% → strong. Makes the map more honest (a 51/49 country
// shouldn't look the same as a 95/5 one) and more interesting to read.
function opacityForShare(leaderShare: number): number {
  return 0.4 + Math.min(Math.max(leaderShare - 0.5, 0), 0.5) * 0.9;
}

// Per dev-prompt-chatgpt.md "MAP MATCH SWITCHING": the Mapbox instance is
// created exactly once (mount effect below). Match switches and new votes
// only call setFeatureState — the map, source and layers are never
// recreated, which is what prevents flicker when switching matches. The
// same goes for switching between light and dark mode: only colors change.
export function GlobalMap({
  match,
  results,
}: {
  match: MatchWithTeams;
  results: CountryResult[];
}) {
  const theme = useTheme();
  // "loading" until Mapbox has drawn the world; "error" if it can't start
  // (missing token, blocked network, WebGL unavailable); "paused" when this
  // month's map budget is used up (lib/mapBudgetServer.ts).
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error" | "paused">(
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? "loading" : "error"
  );
  const budget = useMapBudget();
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
  const themeRef = useRef(theme);
  useEffect(() => {
    matchRef.current = match;
    resultsRef.current = results;
    themeRef.current = theme;
  });

  function createMap(): (() => void) | undefined {
    const token = getMapboxToken();
    const container = containerRef.current;
    if (!token || !container) return undefined;

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
      // which would make refit() think the visitor had moved the map.
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
    function refit() {
      map.resize();
      if (userMoved) return;
      const wide = window.matchMedia("(min-width: 768px)").matches;
      // On desktop the slim match header floats over the top of the map.
      const padding = wide
        ? { top: 84, bottom: 16, left: 16, right: 16 }
        : { top: 8, bottom: 8, left: 8, right: 8 };
      // Reset first: a minZoom left over from a previous (bigger) size
      // would otherwise stop the map from zooming out to fit.
      map.setMinZoom(-2);
      fitWorld(map, padding);
      map.setMinZoom(map.getZoom() - 0.3);
    }
    const resizeObserver = new ResizeObserver(() => refit());
    resizeObserver.observe(container);

    map.on("load", () => {
      const beforeId = tidyBaseStyle(map, { keepCountryLabels: true });
      addCountryLayers(map, { beforeId, withHover: true });
      loadedRef.current = true;
      applyResults();
      setMapStatus("ready");
    });

    // Mapbox reports many harmless errors (a single tile timing out); only
    // a failure before the first successful load means "no map".
    map.on("error", (event) => {
      if (loadedRef.current) return;
      console.error("Map failed to load:", event.error);
      setMapStatus("error");
    });

    // Hover: outline + tooltip (styled in globals.css, .fanmap-popup).
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
      const colors = getMatchColors(m, themeRef.current);
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

    // Paints the map for the current match, results and light/dark mode.
    function applyResults() {
      if (!loadedRef.current) return;
      const m = matchRef.current;
      const colors = getMatchColors(m, themeRef.current);
      const palette = MAP_PALETTE[themeRef.current];
      applyMapPalette(map, themeRef.current);

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
          state = { fillColor: palette.undecided, lineColor: null, opacity: UNDECIDED_OPACITY };
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
  }

  useEffect(() => {
    // Every Mapbox start is billed above 50,000 a month, so it is counted
    // first and only happens while this month's budget lasts.
    let cancelled = false;
    let destroyMap: (() => void) | undefined;
    if (!getMapboxToken() || !containerRef.current) return;
    claimMapLoad().then((allowed) => {
      if (cancelled) return;
      if (!allowed) {
        setMapStatus("paused");
        return;
      }
      destroyMap = createMap();
    });
    return () => {
      cancelled = true;
      destroyMap?.();
    };
    // Intentionally empty: the map is created once — see comment above.
  }, []);

  useEffect(() => {
    applyResultsRef.current?.();
  }, [match.id, results, theme]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {mapStatus !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
          {mapStatus === "paused" ? (
            <p role="status" className="max-w-xs text-sm text-muted">
              The map is taking a break until {formatResetDate(budget?.resetsOn ?? null) ?? "next month"}. Results so
              far are still in the match list.
            </p>
          ) : mapStatus === "loading" ? (
            <p role="status" className="text-sm text-muted motion-safe:animate-pulse">
              Loading the map…
            </p>
          ) : (
            <p role="alert" className="max-w-xs text-sm text-muted">
              The map couldn&apos;t load. You can still vote in the match list — try reloading the page to see the
              map.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
