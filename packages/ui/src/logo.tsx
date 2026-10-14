/** Rounded box with an "o" ring, and the wordmark beside it. design-system §7.1 */
export function Logo({ wordmarkClassName }: { wordmarkClassName?: string } = {}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span aria-hidden className="flex size-7 items-center justify-center rounded-lg bg-ink">
        <span className="size-3 rounded-full border-[2.6px] border-bg" />
      </span>
      <span className={`font-display text-[17px] font-semibold ${wordmarkClassName ?? ''}`}>
        Oraqul
      </span>
    </span>
  );
}
