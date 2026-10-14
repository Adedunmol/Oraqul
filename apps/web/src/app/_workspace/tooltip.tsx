'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * One hover and focus tooltip for every chart mark with a `data-tip` attribute, so charts stay
 * plain markup. `data-rail-tip` shows only while the sidebar is collapsed, where labels are
 * hidden. Mount it once per page tree.
 */
export function Tooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const find = (target: EventTarget | null): { el: HTMLElement; text: string } | null => {
      if (!(target instanceof Element)) return null;
      const el = target.closest<HTMLElement>('[data-tip], [data-rail-tip]');
      if (!el) return null;
      const collapsed = document.documentElement.dataset.sidebar === 'collapsed';
      const text = el.dataset.tip ?? (collapsed ? el.dataset.railTip : undefined);
      return text ? { el, text } : null;
    };
    const move = (event: MouseEvent) => {
      const found = find(event.target);
      setTip(found ? { text: found.text, x: event.clientX, y: event.clientY } : null);
    };
    const focus = (event: FocusEvent) => {
      const found = find(event.target);
      if (!found) return;
      const box = found.el.getBoundingClientRect();
      setTip({ text: found.text, x: box.left + box.width / 2, y: box.top });
    };
    const blur = () => setTip(null);
    document.addEventListener('mousemove', move);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
    };
  }, []);

  if (!tip) return null;
  const width = ref.current?.offsetWidth ?? 200;
  const height = ref.current?.offsetHeight ?? 30;
  const left = Math.max(6, Math.min(window.innerWidth - width - 6, tip.x + 12));
  const top = Math.max(6, tip.y - height - 10);
  return (
    <div
      ref={ref}
      role="tooltip"
      style={{ left, top }}
      className="pointer-events-none fixed z-[90] max-w-[260px] rounded-md bg-ink px-2.5 py-1.5 text-xs text-bg shadow-md"
    >
      {tip.text}
    </div>
  );
}
