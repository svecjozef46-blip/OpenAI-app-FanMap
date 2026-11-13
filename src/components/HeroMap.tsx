"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { HeroCountry } from "@/lib/heroPreview";
import {
  COUNTRY_SOURCE_ID,
  COUNTRY_SOURCE_LAYER,
  COUNTRY_TILESET_URL,
  FILL_LAYER_ID,
  MAP_STYLE,
  PROJECTION,
  WORLDVIEW_FILTER,
  WORLD_BOUNDS,
  addCountryBorders,
  getMapboxToken,
  tidyBaseStyle,
} from "@/lib/mapSetup";

const FADE_IN_MS = 650; // one country fading in
const STAGGER_MS = 25; // delay between consecutive countries (west → east)
const FADE_OUT_MS = 350; // previous match fading out before the next one

export type HeroSlide = { countries: HeroCountry[]; homeColor: string; awayColor: string };

const colorOf = (s: HeroSlide, c: HeroCountry) => (c.side === "home" ? s.homeColor : s.awayColor);

// Decorative, non-interactive world map behind the landing-page headline.
// Each time `slide` changes (the showcase rotates to another match), the
// previous match's colors fade out and the new match's countries "light
// up" one after another, west → east. The Mapbox instance is created once
// and reused for every slide. Visitors who prefer reduced motion get each
// finished map immediately.
//
// Separate from GlobalMap on purpose: no hover, no controls, no polling —
// it's a picture, and keeping it simple keeps the landing page light.
export function HeroMap({ slide }: { slide: HeroSlide }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const frameRef = useRef(0);
  // The slide whose countries are currently colored (null = none yet).
  const shownRef = useRef<HeroSlide | null>(null);
  // Latest requested slide, for the map's load handler.
  const latestSlideRef = useRef(slide);

  function setCountry(c: HeroCountry, color: string | null, progress: number) {
    mapRef.current?.setFeatureState(
      { source: COUNTRY_SOURCE_ID, sourceLayer: COUNTRY_SOURCE_LAYER, id: c.code },
      {
        fillColor: color,
        // Border lights up together with the fill.
        lineColor: progress > 0.5 ? color : null,
        opacity: (0.3 + c.strength * 0.45) * progress,
      }
    );
  }

  // Fade out whatever is shown, then light up `next`. Driven frame by frame
  // because Mapbox doesn't animate feature-state changes on its own.
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
    latestSlideRef.current = slide;
    showSlide(slide);
    // showSlide only touches refs and the map; re-running on `slide` is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

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
      interactive: false,
      attributionControl: false,
      trackResize: false, // handled by the ResizeObserver below
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      map.fitBounds(WORLD_BOUNDS, { padding: 10, animate: false });
    });
    resizeObserver.observe(container);

    map.on("load", () => {
      const beforeId = tidyBaseStyle(map, { keepCountryLabels: false });
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
            "fill-color": ["coalesce", ["feature-state", "fillColor"], "#000000"],
            "fill-opacity": ["coalesce", ["feature-state", "opacity"], 0],
          },
        },
        beforeId
      );
      addCountryBorders(map, beforeId);
      loadedRef.current = true;
      showSlide(latestSlideRef.current);
    });

    return () => {
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
      shownRef.current = null;
    };
    // Created once — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-full w-full" aria-hidden="true" />;
}
