'use client';

import type { Output } from '@oraqul/schema';
import { Button, Icon } from '@oraqul/ui';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { exportOutput } from '@/lib/api/projects';
import { copyText, toast } from '../toast';

type Action = 'pdf' | 'docx' | 'md';

const ACTIONS: { key: Action; label: string; description: string }[] = [
  { key: 'pdf', label: 'Download PDF', description: 'A clean document to send to partners' },
  { key: 'docx', label: 'Download Word', description: 'To edit and merge with your plan' },
  { key: 'md', label: 'Copy as Markdown', description: 'To paste into email, Slack or Notion' },
];

/**
 * Export a launch plan. A menu in the Dropdown's look, positioned by its button, with arrow keys,
 * Escape and focus back to the button. design-system §7.21
 */
export function ExportMenu({ output }: { output: Output }) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  async function run(action: Action) {
    close();
    setBusy(true);
    try {
      const file = await exportOutput(output.id, action);
      if (action === 'md') {
        copyText(await file.text(), 'Markdown copied');
        return;
      }
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${output.title.replace(/[^\p{L}\p{N}]+/gu, '-') || 'plan'}.${action}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('The export did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    const at = items.current.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      event.preventDefault();
      items.current[(to + ACTIONS.length) % ACTIONS.length]?.focus();
    };
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(ACTIONS.length - 1);
    else if (event.key === 'Tab') setOpen(false);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys move focus between the menu's own buttons
    <div ref={root} className="relative" onKeyDown={open ? onKeyDown : undefined}>
      <Button
        ref={trigger}
        icon="export"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${uid}-menu`}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        Export
        <Icon
          name="chevron"
          className={`ml-1 size-4 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </Button>
      {open ? (
        <div
          id={`${uid}-menu`}
          role="menu"
          aria-label="Export the plan"
          className="absolute top-[calc(100%+6px)] right-0 z-50 flex w-[260px] flex-col rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow)]"
        >
          {ACTIONS.map((a, i) => (
            <button
              key={a.key}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitem"
              onClick={() => void run(a.key)}
              className="flex flex-col items-start rounded-lg px-3 py-2 text-left text-[13.5px] outline-none hover:bg-surface2 focus-visible:bg-surface2"
            >
              <span className="font-medium">{a.label}</span>
              <span className="text-[12px] text-muted">{a.description}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
