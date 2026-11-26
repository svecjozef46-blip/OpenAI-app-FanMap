"use client";

import { useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";
import type { HeroCountry } from "@/lib/heroPreview";
import { useTheme } from "@/lib/theme";
import { applyMapPalette, fitWorld } from "@/lib/mapSetup";
import { MAP_ENGINE, isMapEngineConfigured, loadMapEngine, type MapEngine } from "@/lib/mapEngine";
import { claimMapLoad } from "@/lib/mapBudget";

const FADE_IN_MS = 700; // one country fading in
const STAGGER_MS = 22; // delay between consecutive countries (west → east)
const FADE_OUT_MS = 350; // previous match fading out before the next one

export type HeroSlide = { countries: HeroCountry[]; homeColor: string; awayColor: string };

const colorOf = (s: HeroSlide, c: HeroCountry) => (c.side === "home" ? s.homeColor : s.awayColor);

// Decorative, non-interactive world map on the home page. Each time `slide`
// changes (the showcase rotates to another match, or the visitor switches
// light/dark mode), the previous colors fade out and the countries "light
// up" one after another, west → east. The map instance is created once
// and reused for every slide. Visitors who prefer reduced motion get each
// finished map immediately.
//
// Separate from GlobalMap on purpose: no hover, no controls, no polling —
// it's a picture, and keeping it simple keeps the home page light.
export function HeroMap({ slide }: { slide: HeroSlide }) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const loadedRef = useRef(false);
  const frameRef = useRef(0);
  // The slide whose countries are currently colored (null = none yet).
  const shownRef = useRef<HeroSlide | null>(null);
  // Latest props, for the map's load handler.
  const latestRef = useRef({ slide, theme });

  function setCountry(c: HeroCountry, color: string | null, progress: number) {
    const engine = engineRef.current;
    if (!engine) return;
    mapRef.current?.setFeatureState(engine.country(c.code), {
      fillColor: color,
      // Border lights up together with the fill.
      lineColor: progress > 0.5 ? color : null,
      opacity: (0.42 + c.strength * 0.5) * progress,
    });
  }

  // Fade out whatever is shown, then light up `next`. Driven frame by frame
  // because the map libraries don't animate feature-state changes on its own.
  function showSlide(next: HeroSlide) {
    if (!loadedRef.current) return;
    cancelAnimationFrame(frameRef.current);
    const previous = shownRef.current;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      previous?.countries.forEach((c) => setCountry(c, null, 0));
      next.countries.forEach((c) => setCountry(c, colorOf(next, c), 1));
      shownRef.current = next;
      return;
    }

    const start = performance.now();
    const fadeOutMs = previous ? FADE_OUT_MS : 0;
    let switched = false;
    const tick = (now: number) => {
      const elapsed = now - start;
      let done = true;
      if (previous && elapsed < fadeOutMs) {
        const p = 1 - elapsed / fadeOutMs;
        previous.countries.forEach((c) => setCountry(c, colorOf(previous, c), p));
        done = false;
      } else {
        if (!switched) {
          previous?.countries.forEach((c) => setCountry(c, null, 0));
          shownRef.current = next;
          switched = true;
        }
        const t0 = elapsed - fadeOutMs;
        next.countries.forEach((c, i) => {
          const t = (t0 - i * STAGGER_MS) / FADE_IN_MS;
          if (t < 1) done = false;
          if (t > 0) setCountry(c, colorOf(next, c), 1 - Math.pow(1 - Math.min(t, 1), 3));
        });
      }
      if (!done) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    latestRef.current = { slide, theme };
    if (!loadedRef.current || !mapRef.current) return;
    applyMapPalette(mapRef.current, theme);
    if (shownRef.current !== slide) showSlide(slide);
    // showSlide only touches refs and the map; re-running on these is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, theme]);

  function createMap(engine: MapEngine): (() => void) | undefined {
    const container = containerRef.current;
    if (!engine.isConfigured() || !container) return undefined;

    // Resizing is handled by the ResizeObserver below.
    const map = engine.createMap({
      container,
      interactive: false,
      attribution: "compact",
      withHover: false,
      countryLabels: false,
    });
    engineRef.current = engine;
    mapRef.current = map;

    // Keep the whole world in view at any size, leaving room for what
    // HeroShowcase floats over the map: on desktop the headline in the
    // bottom-left corner (empty South Pacific), on phones the match caption
    // along the bottom.
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      const wide = window.matchMedia("(min-width: 768px)").matches;
      const padding = wide
        ? { top: 12, bottom: 12, left: Math.round(container.clientWidth * 0.1), right: 12 }
        : { top: 8, bottom: 96, left: 8, right: 8 };
      fitWorld(map, padding);
    });
    resizeObserver.observe(container);

    map.on("load", () => {
      engine.setupLayers(map, { withHover: false, countryLabels: false, theme: latestRef.current.theme });
      loadedRef.current = true;
      showSlide(latestRef.current.slide);
    });

    return () => {
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      engineRef.current = null;
      loadedRef.current = false;
      shownRef.current = null;
    };
  }

  useEffect(() => {
    // Every Mapbox start is billed above 50,000 a month, so it is counted
    // first (lib/mapBudget.ts). When the budget is used up the hero simply
    // shows no map; the banner at the top of the page explains why.
    // MapLibre isn't billed: never counted, always started.
    let cancelled = false;
    let destroyMap: (() => void) | undefined;
    if (!isMapEngineConfigured() || !containerRef.current) return;
    const allowedPromise = MAP_ENGINE === "mapbox" ? claimMapLoad() : Promise.resolve(true);
    Promise.all([loadMapEngine(), allowedPromise]).then(
      ([engine, allowed]) => {
        if (cancelled || !allowed) return;
        destroyMap = createMap(engine);
      },
      (error) => console.error("Map failed to load:", error)
    );
    return () => {
      cancelled = true;
      destroyMap?.();
    };
    // Created once — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-full w-full" aria-hidden="true" />;
}
