/** Says plainly that a screen runs on invented data, so no number is mistaken for Qloo's. */
export function DemoNote() {
  return (
    <p className="w-fit max-w-full rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-muted">
      <span className="font-semibold text-ink">Demo data</span> · names, numbers and receipts here
      are invented. Nothing calls Qloo yet.
    </p>
  );
}
