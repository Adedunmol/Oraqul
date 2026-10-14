import type { ReactNode } from 'react';

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  /** A count shown after the label, such as the number of evidence lines. */
  count?: number;
}

/**
 * A controlled segmented control. The parent owns which tab is selected. design-system §7.9
 * `onSelect` makes it a client-only component in practice.
 */
export function Tabs<K extends string>({
  items,
  selected,
  onSelect,
  label,
}: {
  items: TabItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-lg bg-surface2 p-1"
    >
      {items.map((item) => {
        const on = item.key === selected;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(item.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13.5px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transition-none ${on ? 'bg-card font-semibold text-ink' : 'text-muted hover:text-ink'}`}
          >
            {item.label}
            {item.count ? (
              <span className="rounded-full bg-surface2 px-1.5 text-[11px] tabular-nums">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** One muted sentence on what a tab shows. design-system §7.10 */
export function TabNote({ children }: { children: ReactNode }) {
  return <p className="max-w-[68ch] text-[13.5px] text-muted">{children}</p>;
}

/** A keycap. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block min-w-[22px] rounded-[5px] border border-line bg-surface px-1.5 py-[3px] text-center font-mono text-[11px] leading-none font-medium text-muted">
      {children}
    </kbd>
  );
}
