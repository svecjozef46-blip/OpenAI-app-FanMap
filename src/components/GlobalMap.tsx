"use client";

import { useEffect, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import type { CountryResult, MatchWithTeams } from "@/lib/types";
import { countryName, splitPercent } from "@/lib/format";
import { getMatchColors } from "@/lib/teamColors";
import { useTheme } from "@/lib/theme";
import { FILL_LAYER_ID, MAP_PALETTE, applyMapPalette, fitWorld } from "@/lib/mapSetup";
import { MAP_ENGINE, isMapEngineConfigured, loadMapEngine, preloadMapData, type MapEngine } from "@/lib/mapEngine";
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

// Color changes (a new vote, a match switch, light/dark mode) fade over this
// long instead of jumping. Neither map library animates feature-state on
// its own, so applyResults() drives it frame by frame, like HeroMap does.
const COLOR_FADE_MS = 450;

type Rgb = [number, number, number];
type CountryLook = { fill: Rgb; line: string | null; opacity: number };

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbCss = ([r, g, b]: Rgb) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Per dev-prompt-chatgpt.md "MAP MATCH SWITCHING": the map instance is
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
  // Start downloading the map data with the page (MapLibre only).
  preloadMapData({ labels: true });
  // "loading" until the map has drawn the world; "error" if it can't start
  // (missing Mapbox token, blocked network, WebGL unavailable); "paused"
  // when this month's Mapbox budget is used up (lib/mapBudgetServer.ts;
  // never with MapLibre, which isn't billed — see lib/mapEngine.ts).
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error" | "paused">(
    isMapEngineConfigured() ? "loading" : "error"
  );
  const budget = useMapBudget();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  // Countries we've colored, so the next update can clear exactly those
  // first — otherwise a country colored for the previous match would stay.
  // What each colored country currently shows, so the next update can fade
  // from there (and clear countries the new match/results don't color).
  const shownRef = useRef<Map<string, CountryLook>>(new Map());
  const fadeFrameRef = useRef(0);

  // The mount effect owns applyResults (it needs the map instance); this
  // ref lets the last effect below call it on every match switch / new vote.
  const applyResultsRef = useRef<((options?: { animate?: boolean }) => void) | null>(null);

  // Latest props for the event handlers created once in the mount effect.
  const matchRef = useRef(match);
  const resultsRef = useRef(results);
  const themeRef = useRef(theme);
  useEffect(() => {
    matchRef.current = match;
    resultsRef.current = results;
    themeRef.current = theme;
  });

  function createMap(engine: MapEngine): (() => void) | undefined {
    const container = containerRef.current;
    if (!engine.isConfigured() || !container) return undefined;

    // The engine sets the shared look (style, projection, start bounds, no
    // world copies) and turns off its own window-resize handling: resizing
    // is handled by the ResizeObserver below. The library's own handling
    // tags its camera events like user input, which would make refit()
    // think the visitor had moved the map.
    const map = engine.createMap({
      container,
      interactive: true,
      attribution: "default",
      // On phones the map sits inside a scrolling page: one finger scrolls
      // the page, two fingers move the map (the map shows a hint).
      cooperativeGestures: window.matchMedia("(max-width: 767px)").matches,
      withHover: true,
      countryLabels: true,
    });
    mapRef.current = map;
    // Development only (removed from production builds): lets scripts and
    // the browser console inspect the map, e.g. which labels are placed.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __fanmapMap?: mapboxgl.Map }).__fanmapMap = map;
    }
    map.touchZoomRotate.disableRotation();
    map.addControl(new engine.NavigationControl({ showCompass: false }), "bottom-right");

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
      engine.setupLayers(map, { withHover: true, countryLabels: true, theme: themeRef.current });
      loadedRef.current = true;
      // The map fades in with its colors already in place (no fade here).
      applyResults({ animate: false });
      setMapStatus("ready");
    });

    // The browser can take the map's graphics context away (iOS Safari does
    // it to pages in the background). The library redraws the shapes when
    // it's back, but the team colors are lost with it: paint them again.
    // MapLibre reloads its whole style on restore, so wait until that's done.
    map.on("webglcontextrestored", () => {
      if (!loadedRef.current) return;
      map.once("idle", () => {
        shownRef.current = new Map();
        applyResults({ animate: false });
      });
    });

    // The map reports many harmless errors (a single tile timing out); only
    // a failure before the first successful load means "no map".
    map.on("error", (event) => {
      if (loadedRef.current) return;
      console.error("Map failed to load:", event.error);
      setMapStatus("error");
    });

    // Hover: outline + tooltip (styled in globals.css, .fanmap-popup).
    let hoveredId: string | number | null = null;
    const popup = new engine.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "fanmap-popup",
      offset: 12,
    });

    function setHover(id: string | number | null, hover: boolean) {
      if (id === null) return;
      map.setFeatureState(engine.country(id), { hover });
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

    function clearHover() {
      setHover(hoveredId, false);
      hoveredId = null;
      popup.remove();
      map.getCanvas().style.cursor = "";
    }
    map.on("mouseleave", FILL_LAYER_ID, clearHover);
    // Leaving the map straight from a country (e.g. onto the header above
    // it) must clear the outline and tooltip too.
    map.on("mouseout", clearHover);

    // Paints the map for the current match, results and light/dark mode,
    // fading each country from what it shows now to its new look.
    function applyResults({ animate = true }: { animate?: boolean } = {}) {
      if (!loadedRef.current) return;
      const m = matchRef.current;
      const colors = getMatchColors(m, themeRef.current);
      const palette = MAP_PALETTE[themeRef.current];
      applyMapPalette(map, themeRef.current);

      const target = new Map<string, CountryLook>();
      for (const r of resultsRef.current) {
        if (r.totalVotes === 0) continue;
        if (!r.leadingTeamId) {
          target.set(r.countryCode, { fill: hexToRgb(palette.undecided), line: null, opacity: UNDECIDED_OPACITY });
        } else {
          const homeLeads = r.leadingTeamId === m.home_team_id;
          const leaderVotes = homeLeads ? r.homeVotes : r.awayVotes;
          const color = homeLeads ? colors.home : colors.away;
          target.set(r.countryCode, {
            fill: hexToRgb(color),
            line: color,
            opacity: opacityForShare(leaderVotes / r.totalVotes),
          });
        }
      }

      // From → to for every country that is colored now or will be. A
      // country appearing fades in in its new color, one disappearing fades
      // out in its old one.
      const from = shownRef.current;
      const changes: Array<{ code: string; a: CountryLook; b: CountryLook }> = [];
      for (const code of new Set([...from.keys(), ...target.keys()])) {
        const a = from.get(code);
        const b = target.get(code);
        const start = a ?? { ...b!, opacity: 0, line: null };
        const end = b ?? { ...a!, opacity: 0, line: null };
        if (a && b && a.opacity === b.opacity && a.line === b.line && a.fill.every((v, i) => v === b.fill[i])) continue;
        changes.push({ code, a: start, b: end });
      }
      shownRef.current = target;

      const paint = (t: number) => {
        for (const { code, a, b } of changes) {
          const done = t >= 1;
          const opacity = mix(a.opacity, b.opacity, t);
          map.setFeatureState(engine.country(code), {
            fillColor: done && b.opacity === 0 ? null : rgbCss(a.fill.map((v, i) => mix(v, b.fill[i], t)) as Rgb),
            // The border switches to the team color halfway, with the fill.
            lineColor: t < 0.5 ? a.line : b.line,
            opacity,
          });
        }
      };

      cancelAnimationFrame(fadeFrameRef.current);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate || reduceMotion || changes.length === 0) {
        paint(1);
        return;
      }
      const startTime = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - startTime) / COLOR_FADE_MS, 1);
        paint(1 - Math.pow(1 - t, 3)); // ease-out
        if (t < 1) fadeFrameRef.current = requestAnimationFrame(tick);
      };
      fadeFrameRef.current = requestAnimationFrame(tick);
    }
    applyResultsRef.current = applyResults;

    return () => {
      cancelAnimationFrame(fadeFrameRef.current);
      resizeObserver.disconnect();
      popup.remove();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
      applyResultsRef.current = null;
      shownRef.current = new Map();
    };
  }

  useEffect(() => {
    // Every Mapbox start is billed above 50,000 a month, so it is counted
    // first and only happens while this month's budget lasts. MapLibre
    // costs nothing: never counted, always started, whatever the budget
    // says. The map library itself is loaded meanwhile (lib/mapEngine.ts).
    let cancelled = false;
    let destroyMap: (() => void) | undefined;
    if (!isMapEngineConfigured() || !containerRef.current) return;
    const allowedPromise = MAP_ENGINE === "mapbox" ? claimMapLoad() : Promise.resolve(true);
    Promise.all([loadMapEngine(), allowedPromise]).then(
      ([engine, allowed]) => {
        if (cancelled) return;
        if (!allowed) {
          setMapStatus("paused");
          return;
        }
        destroyMap = createMap(engine);
      },
      (error) => {
        // The map library's code couldn't be downloaded.
        if (cancelled) return;
        console.error("Map failed to load:", error);
        setMapStatus("error");
      }
    );
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
    <div className="relative h-full w-full" data-map-status={mapStatus}>
      {/* Hidden until the map has drawn the world with its colors, then
          faded in: no empty map first, no colors repainted after. The fade
          is on a wrapper: the map library adds its own classes to the
          container itself, which a changing className would wipe out. */}
      <div
        className={`h-full w-full transition-opacity duration-500 ease-out motion-reduce:transition-none ${
          mapStatus === "ready" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div ref={containerRef} role="region" aria-label="World map: the team each country supports" className="h-full w-full" />
      </div>
      {mapStatus !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
          {mapStatus === "paused" ? (
            <p role="status" className="max-w-xs text-sm text-muted">
              The map is taking a break until {formatResetDate(budget?.resetsOn ?? null) ?? "next month"}. Results so
              far are still in the match list.
            </p>
          ) : mapStatus === "loading" ? (
            // Shown only if loading takes a while (the delay is in
            // globals.css), so a quick load is just the map fading in.
            <p role="status" className="fanmap-map-loading text-sm text-muted">
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
