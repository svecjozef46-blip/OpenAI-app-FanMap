"use client";

import { useMapBudget } from "@/lib/mapBudget";
import { pausedMessage } from "@/lib/mapBudgetMessage";

// Site-wide notice while the monthly map budget is used up (see
// lib/mapBudgetServer.ts): the map and voting are paused, results stay
// visible. Renders nothing the rest of the time.
export function PausedBanner() {
  const budget = useMapBudget();
  if (!budget?.paused) return null;
  return (
    <div role="status" className="z-30 shrink-0 bg-warn/15 px-4 py-2 text-center text-[13px] leading-snug text-fg">
      {pausedMessage(budget.resetsOn)} <span className="text-muted">Results so far stay visible.</span>
    </div>
  );
}
