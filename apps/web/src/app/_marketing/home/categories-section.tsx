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
      <h3 className="font-display text-[clamp(30px,3.4vw,46px)] leading-[1.05] font-medium tracking-[-0.03em]">
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
          Checked against real audience data
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

/** Cards on a phone, where six pinned panels would stack into a very long scroll. */
function CategoryCards({ infos }: { infos: CategoryInfo[] }) {
  return (
    <ul className="grid gap-3 min-[560px]:grid-cols-2 min-[1000px]:hidden">
      {infos.map((info) => (
        <li key={info.id} data-cat={info.id}>
          <Link
            href={`/categories#${info.id}`}
            className={`flex h-full min-h-[168px] flex-col justify-between gap-8 rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${field}`}
          >
            <Icon name={info.id} className="size-7" />
            <span className="flex flex-col gap-1.5">
              <span className="font-display text-[24px] leading-[1.05] font-semibold tracking-[-0.03em]">
                {info.name}
              </span>
              <span className="text-[14.5px] leading-[1.45] opacity-90">{info.blurb}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CategoriesSection() {
  const infos = categories.map((id) => getCategory(id));
  return (
    <section aria-labelledby="cats-title" className={band}>
      <div className={`${wrap} flex flex-col gap-14 min-[1000px]:gap-4`}>
        <div className="grid gap-5 min-[900px]:grid-cols-[1.3fr_1fr] min-[900px]:items-end">
          <h2 id="cats-title" className={h2Class}>
            Made for six kinds of launch.
          </h2>
          <p className={`${leadClass} min-[900px]:justify-self-end`}>
            Each has its own questions, its own calendar and its own way to read the results.
          </p>
        </div>
        <CategoryCards infos={infos} />
        <div className="max-[999px]:hidden">
          <StickySteps
            label="Six categories"
            steps={infos.map((info) => ({
              id: info.id,
              text: <CategoryText info={info} />,
              visual: <CategoryVisual info={info} />,
            }))}
          />
        </div>
      </div>
    </section>
  );
}
