// Two-color percentage bar, used in match cards and the header above the
// map. With zero votes it still renders (dev-prompt: "always-visible
// percentage distribution bar") but as a muted 50/50, so it can't be
// mistaken for real support.
export function SupportBar({
  homePct,
  homeColor,
  awayColor,
  isEmpty,
  height = 6,
}: {
  homePct: number;
  homeColor: string;
  awayColor: string;
  isEmpty: boolean;
  height?: number;
}) {
  const awayPct = 100 - homePct;
  // A 2px gap between the halves, except when one side is 0% (then the
  // other side should fill the whole bar, with no sliver of the other color).
  const showGap = homePct > 0 && awayPct > 0;

  return (
    <div
      className="flex w-full overflow-hidden rounded-full bg-white/[0.06]"
      style={{ height, gap: showGap ? 2 : 0 }}
      role="img"
      aria-label={isEmpty ? "No votes yet" : `${homePct}% to ${awayPct}%`}
    >
      <div
        className="h-full shrink-0 transition-[width] duration-700 ease-out motion-reduce:transition-none"
        style={{
          width: showGap ? `calc(${homePct}% - 1px)` : `${homePct}%`,
          backgroundColor: homeColor,
          opacity: isEmpty ? 0.25 : 1,
        }}
      />
      <div
        className="h-full shrink-0 transition-[width] duration-700 ease-out motion-reduce:transition-none"
        style={{
          width: showGap ? `calc(${awayPct}% - 1px)` : `${awayPct}%`,
          backgroundColor: awayColor,
          opacity: isEmpty ? 0.25 : 1,
        }}
      />
    </div>
  );
}
