import { type Category, categories } from '@oraqul/schema';
import { Icon } from '@oraqul/ui';
import type { CSSProperties } from 'react';
import { coverageColumns } from '@/app/_workspace/category-coverage';
import { getCategory } from '@/lib/demo/catalog';
import { Reveal } from '../reveal';
import { wrap } from '../section';

const field = 'bg-[color-mix(in_srgb,var(--cat)_74%,var(--ink))] text-bg';

export function CategoryTiles() {
  return (
    <ul className="flex flex-col gap-2">
      {categories.map((id) => {
        const info = getCategory(id);
        return (
          <li key={id} data-cat={id}>
            <a
              href={`#${id}`}
              className={`group flex items-center gap-4 rounded-2xl px-5 py-4 transition-transform duration-150 hover:translate-x-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${field}`}
            >
              <Icon name={id} className="size-6 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-display text-[19px] font-semibold tracking-[-0.02em]">
                  {info.name}
                </span>
                <span className="truncate text-[14px]">{info.blurb}</span>
              </span>
              <Icon name="chevron" className="size-5 shrink-0" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function CategorySection({ id, index }: { id: Category; index: number }) {
  const info = getCategory(id);
  const columns = coverageColumns(info);
  const flip = index % 2 === 1;
  return (
    <section
      id={id}
      data-cat={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 py-[clamp(28px,4vw,48px)]"
    >
      <Reveal className={`${wrap} grid gap-3 min-[1000px]:grid-cols-[0.85fr_1.15fr]`}>
        <div
          className={`flex min-h-72 flex-col justify-between gap-8 rounded-2xl p-[clamp(22px,3.4vw,40px)] ${field} ${flip ? 'min-[1000px]:order-2' : ''}`}
        >
          <Icon name={id} className="size-8" />
          <div className="flex flex-col gap-4">
            <h2
              id={`${id}-title`}
              className="font-display text-[clamp(34px,4.4vw,56px)] leading-[1] font-semibold tracking-[-0.045em]"
            >
              {info.name}
            </h2>
            <p className="max-w-[34ch] text-[17px] leading-[1.5]">{info.blurb}</p>
            <ul aria-label={`Views in ${info.name}`} className="flex flex-wrap gap-1.5">
              {info.tools.map((t) => (
                <li key={t} className="rounded-md bg-ink/25 px-2.5 py-1 text-[13px] font-medium">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl bg-line shadow-sm sm:grid-cols-3">
          {columns.map((c, i) => (
            <div
              key={c.title}
              className="mk-in flex flex-col gap-4 bg-card p-[clamp(18px,2.4vw,28px)]"
              style={{ '--i': i } as CSSProperties}
            >
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
                  {c.title}
                </h3>
                <p className="text-[13.5px] text-muted">{c.note}</p>
              </div>
              <ul className="flex flex-col gap-3.5 text-[15px] leading-[1.5]">
                {c.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function CategorySections() {
  return (
    <div className="py-[clamp(24px,4vw,56px)]">
      {categories.map((id, i) => (
        <CategorySection key={id} id={id} index={i} />
      ))}
    </div>
  );
}
