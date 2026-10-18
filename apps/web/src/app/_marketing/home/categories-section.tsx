import { type CategoryInfo, categories } from '@oraqul/schema';
import { Icon } from '@oraqul/ui';
import Link from 'next/link';
import { getCategory } from '@/lib/demo/catalog';
import { band, h2Class, leadClass, wrap } from '../section';
import { StickySteps } from '../sticky-steps';

// Mixed with ink so --bg text keeps 4.5:1 on every category, orange included (design-system §6).
const field = 'bg-[color-mix(in_srgb,var(--cat)_74%,var(--ink))] text-bg';

function CategoryText({ info }: { info: CategoryInfo }) {
  return (
    <div data-cat={info.id} className="flex flex-col gap-5">
      <span className={`grid size-12 place-items-center rounded-xl ${field}`}>
        <Icon name={info.id} className="size-6" />
      </span>
      <h3 className="font-display text-[clamp(30px,3.4vw,46px)] leading-[1.02] font-semibold tracking-[-0.04em]">
        {info.name}
      </h3>
      <p className="max-w-[38ch] text-[18px] leading-[1.55] text-ink/75">{info.blurb}</p>
      <ul aria-label={`Views in ${info.name}`} className="flex flex-wrap gap-1.5">
        {info.tools.map((t) => (
          <li key={t} className="rounded-md bg-surface2 px-2.5 py-1 text-[13px]">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryVisual({ info }: { info: CategoryInfo }) {
  return (
    <div
      data-cat={info.id}
      className={`flex flex-col justify-between gap-12 min-[1000px]:min-h-[min(74vh,640px)] rounded-2xl p-[clamp(26px,4.4vw,64px)] shadow-lg ${field}`}
    >
      {/* Below 1000px the panel sits right under the heading that already names the category. */}
      <div className="hidden items-center justify-between gap-4 min-[1000px]:flex">
        <Icon name={info.id} className="size-11" />
        <span className="font-display text-[17px] font-semibold">{info.short}</span>
      </div>
      <div className="flex flex-col gap-5">
        <p className="font-display text-[clamp(26px,2.8vw,38px)] leading-[1.1] font-semibold tracking-[-0.03em]">
          Tested against Qloo, with a receipt
        </p>
        <ul className="flex flex-col gap-4 text-[clamp(16px,1.4vw,19px)] leading-[1.5]">
          {info.coverage.tests.map((t) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden="true">✓</span>
              {t}
            </li>
          ))}
        </ul>
        <Link
          href={`/categories#${info.id}`}
          className="w-fit rounded-lg bg-bg px-4 py-2.5 text-[15px] font-medium text-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bg"
        >
          What it reads and what you bring
        </Link>
      </div>
    </div>
  );
}

export function CategoriesSection() {
  const infos = categories.map((id) => getCategory(id));
  return (
    <section aria-labelledby="cats-title" className={band}>
      <div className={`${wrap} flex flex-col gap-14 min-[1000px]:gap-4`}>
        <div className="grid gap-5 min-[900px]:grid-cols-[1.3fr_1fr] min-[900px]:items-end">
          <h2 id="cats-title" className={h2Class}>
            Every kind of launch, tested its own way.
          </h2>
          <p className={`${leadClass} min-[900px]:justify-self-end`}>
            A tour is planned city by city, a book against its comparable titles, a game by the fan
            bases next to it.
          </p>
        </div>
        <StickySteps
          label="Five categories"
          steps={infos.map((info) => ({
            id: info.id,
            text: <CategoryText info={info} />,
            visual: <CategoryVisual info={info} />,
          }))}
        />
      </div>
    </section>
  );
}
