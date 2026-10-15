'use client';

import { Icon } from '@oraqul/ui';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

// Lives here, not in packages/ui, for the same reason as Modal: that package has no client entry,
// and a component with state would break the server components that import from it.

export interface DropdownOption<V extends string> {
  value: V;
  label: string;
  /** A muted line under the label, for options that need explaining. */
  description?: string;
  disabled?: boolean;
}

interface DropdownProps<V extends string> {
  id: string;
  /** Required so the field is announced. `hideLabel` keeps it for screen readers only. */
  label: string;
  hideLabel?: boolean;
  value: V;
  onChange: (value: V) => void;
  options: DropdownOption<V>[];
  disabled?: boolean;
  /** Which edge of the field the menu lines up with. `end` for a field at the right of a row. */
  align?: 'start' | 'end';
  /** For the field itself, such as a width. */
  className?: string;
}

/** A menu of a few options, in our own look instead of the browser's. design-system §7.21 */
export function Dropdown<V extends string>(props: DropdownProps<V>) {
  return <Menu {...props} />;
}

/** The same, with a search box that narrows a long list. Arrow keys work from the box. */
export function SearchDropdown<V extends string>(
  props: DropdownProps<V> & { searchPlaceholder?: string; emptyText?: string },
) {
  return <Menu {...props} search />;
}

const OPEN_UP_BELOW_PX = 280;

function Menu<V extends string>({
  id,
  label,
  hideLabel,
  value,
  onChange,
  options,
  disabled,
  align = 'start',
  className,
  search,
  searchPlaceholder = 'Search',
  emptyText = 'No matches',
}: DropdownProps<V> & { search?: boolean; searchPlaceholder?: string; emptyText?: string }) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const listId = `${uid}-list`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: '', timer: 0 });
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const selected = options.find((o) => o.value === value);
  const optionId = (i: number) => `${uid}-o-${i}`;
  // A select-only combobox: focus stays on the field while the arrow keys move through the
  // options, and aria-activedescendant says which one is current. With a search box, the box is
  // the combobox instead, so the field stays a plain button.
  const comboboxProps = search
    ? {}
    : { role: 'combobox', 'aria-activedescendant': open ? optionId(active) : undefined };

  function openMenu() {
    if (disabled) return;
    const box = trigger.current?.getBoundingClientRect();
    if (box) {
      const below = window.innerHeight - box.bottom;
      setOpenUp(below < OPEN_UP_BELOW_PX && box.top > below);
    }
    setQuery('');
    const at = options.findIndex((o) => o.value === value && !o.disabled);
    setActive(
      at >= 0
        ? at
        : Math.max(
            0,
            options.findIndex((o) => !o.disabled),
          ),
    );
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function choose(option: DropdownOption<V> | undefined) {
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  }

  function step(from: number, delta: 1 | -1): number {
    for (let i = from + delta; i >= 0 && i < visible.length; i += delta) {
      if (!visible[i]?.disabled) return i;
    }
    return from;
  }

  useEffect(() => {
    if (!open) return;
    if (search) searchBox.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, search]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  });

  function onKeyDown(event: KeyboardEvent) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((i) => step(i, 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setActive((i) => step(i, -1));
        return;
      case 'Home':
        if (search) return;
        event.preventDefault();
        setActive(step(-1, 1));
        return;
      case 'End':
        if (search) return;
        event.preventDefault();
        setActive(step(visible.length, -1));
        return;
      case 'Enter':
        event.preventDefault();
        choose(visible[active]);
        return;
      case ' ':
        if (search) return;
        event.preventDefault();
        choose(visible[active]);
        return;
      case 'Escape':
        event.preventDefault();
        close();
        return;
      case 'Tab':
        close(false);
        return;
    }
    if (!search && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      // Type the start of a label to jump to it, as a native select does.
      window.clearTimeout(typed.current.timer);
      typed.current.text += event.key.toLowerCase();
      typed.current.timer = window.setTimeout(() => {
        typed.current.text = '';
      }, 600);
      const hit = visible.findIndex(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text),
      );
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <div ref={root} className="relative flex flex-col gap-1.5">
      <span id={labelId} className={hideLabel ? 'sr-only' : 'text-[13px] font-medium text-ink'}>
        {label}
      </span>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${labelId} ${id}`}
        {...comboboxProps}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-expanded:border-accent disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none ${className ?? ''}`}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <Icon
          name="chevron"
          className={`size-4 text-muted transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div
          className={`pop-in absolute z-50 w-max min-w-full max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-lg ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} ${align === 'end' ? 'right-0' : 'left-0'}`}
        >
          {search ? (
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Icon name="search" className="size-4 text-muted" />
              <input
                ref={searchBox}
                type="text"
                role="combobox"
                aria-label={`Search ${label}`}
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={visible.length ? optionId(active) : undefined}
                value={query}
                placeholder={searchPlaceholder}
                autoComplete="off"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted focus:outline-none"
              />
            </div>
          ) : null}
          <div
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            className="max-h-64 overflow-y-auto p-1"
          >
            {visible.map((option, i) => {
              const on = option.value === value;
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the field keeps focus and handles the keys; an option is only ever clicked
                <div
                  key={option.value}
                  id={optionId(i)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={on}
                  aria-disabled={option.disabled || undefined}
                  onPointerMove={() => !option.disabled && setActive(i)}
                  // The field keeps focus, so a press must not blur it before the click lands.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-sm ${i === active ? 'bg-surface2' : ''} ${on ? 'font-semibold' : ''} ${option.disabled ? 'cursor-not-allowed opacity-45' : ''}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description ? (
                      <span className="text-[12.5px] font-normal leading-[1.4] text-muted">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {on ? <Icon name="check" className="mt-0.5 size-4 shrink-0 text-accent" /> : null}
                </div>
              );
            })}
            {visible.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-[13px] text-muted">{emptyText}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
