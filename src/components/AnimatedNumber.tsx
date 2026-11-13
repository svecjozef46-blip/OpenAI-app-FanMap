"use client";

import { useEffect, useRef, useState } from "react";

// Counts smoothly from the previous value to the new one (~0.6s) when a
// vote total changes. Short and only on real changes — never a continuous
// animation. Skipped entirely for visitors who asked their OS for reduced
// motion.
export function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;
    if (from === value) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 0 : 600;
    const start = performance.now();
    let frame = 0;

    function tick(now: number) {
      const t = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="tabular-nums">{displayed.toLocaleString("en-US")}</span>;
}
