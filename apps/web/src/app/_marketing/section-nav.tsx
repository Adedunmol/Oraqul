'use client';

import { useEffect, useState } from 'react';

/** Just under the sticky header, matching the `scroll-mt-24` on each section. */
const LINE = 120;

/**
 * The contents list beside a long page. The section the reader is in is lit: the last one whose
 * top has passed the header, or the last section once the page ends, since a short final section
 * never reaches the line on its own.
 */
export function SectionNav({ sections }: { sections: readonly { id: string; title: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? '');

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = sections[0]?.id ?? '';
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= LINE) current = s.id;
      }
      setActive(atEnd ? (sections.at(-1)?.id ?? current) : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <nav aria-label="On this page" className="max-[999px]:hidden">
      <ol className="sticky top-24 flex flex-col gap-1 text-[14px]">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? 'location' : undefined}
              onClick={() => setActive(s.id)}
              className="block rounded-lg px-3 py-1.5 text-muted transition-colors duration-150 hover:bg-surface2 hover:text-ink aria-[current=location]:bg-accent-soft aria-[current=location]:font-semibold aria-[current=location]:text-accent motion-reduce:transition-none"
            >
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
