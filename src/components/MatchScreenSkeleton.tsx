// Placeholder shown while a match screen loads its data (used by the
// loading.tsx files next to the league and match pages). It mirrors the
// real layout — nav, match list, map — so nothing jumps when the content
// arrives. Purely decorative, hence aria-hidden plus one status line for
// screen readers.
export function MatchScreenSkeleton() {
  const bar = "rounded-full bg-fg/[0.08]";
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <p role="status" className="sr-only">
        Loading matches…
      </p>
      <div className="h-12 shrink-0 border-b border-line" aria-hidden="true" />
      <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-pulse md:flex-row" aria-hidden="true">
        <div className="order-2 flex shrink-0 flex-col gap-2 p-3 md:order-1 md:w-80 md:border-r md:border-line">
          <div className={`mb-1 h-4 w-32 ${bar}`} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-2xl bg-surface p-3">
              <div className={`h-3 w-24 ${bar}`} />
              <div className="flex gap-2">
                <div className="h-10 flex-1 rounded-xl bg-fg/[0.06]" />
                <div className="h-10 flex-1 rounded-xl bg-fg/[0.06]" />
              </div>
              <div className={`h-1 w-full ${bar}`} />
              <div className={`h-3 w-40 ${bar}`} />
            </div>
          ))}
        </div>
        <div className="order-1 flex min-h-[calc(52vw+16px)] flex-1 items-center justify-center md:order-2">
          <span className="text-sm text-muted">Loading the map…</span>
        </div>
      </div>
    </div>
  );
}
