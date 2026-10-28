'use client';

import type { OutputTabKey } from '@oraqul/schema';
import { Icon } from '@oraqul/ui';
import { useState } from 'react';
import { OutputView } from '@/app/_workspace/output/output-view';
import { Toaster } from '@/app/_workspace/toast';
import { Tooltip } from '@/app/_workspace/tooltip';
import { exampleDetails } from '@/lib/examples';
import { type ExampleCase, exampleCases } from './cases';

/**
 * The three showcase launches as large cards, and the real output screen for the chosen one,
 * read only. The choice lives in ?case= so a link opens it.
 */
export function ExamplesView({
  initialCase,
  initialTab,
}: {
  initialCase: ExampleCase;
  initialTab: OutputTabKey | undefined;
}) {
  const [current, setCurrent] = useState(initialCase);
  const [tab, setTab] = useState(initialTab);
  const detail = exampleDetails[current.id];

  const choose = (c: ExampleCase) => {
    setCurrent(c);
    setTab(undefined);
    const url = new URL(window.location.href);
    url.searchParams.set('case', c.id);
    url.searchParams.delete('tab');
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid gap-3 min-[900px]:grid-cols-3">
        {exampleCases.map((c) => {
          const on = c.id === current.id;
          return (
            <li key={c.id} data-cat={c.category} className="flex">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => choose(c)}
                className={`flex w-full flex-col overflow-hidden rounded-2xl text-left transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${on ? 'bg-card shadow-lg outline-2 outline-offset-2 outline-accent' : 'bg-card shadow-sm'}`}
              >
                <span className="flex items-center justify-between gap-3 bg-[color-mix(in_srgb,var(--cat)_74%,var(--ink))] px-5 py-3.5 text-bg">
                  <span className="flex items-center gap-2.5 text-[14px] font-semibold">
                    <Icon name={c.category} className="size-4" />
                    {c.job}
                  </span>
                  {on ? (
                    <span className="rounded-md bg-bg px-2 py-0.5 text-[12px] font-semibold text-ink">
                      Showing
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-1 flex-col gap-2 p-5">
                  <span className="font-display text-[24px] font-semibold tracking-[-0.03em]">
                    {c.title}
                  </span>
                  <span className="text-[13.5px] text-muted">{c.meta}</span>
                  <span className="pt-1 text-[16px] leading-[1.65] text-ink/80">{c.why}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="overflow-hidden rounded-2xl bg-bg shadow-lg">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3.5 min-[700px]:px-[clamp(16px,3vw,32px)] text-[13.5px]">
          <span className="rounded-md bg-surface2 px-2 py-0.5 text-[12.5px] font-medium text-muted">
            Example
          </span>
          Invented data for a made up {current.noun}, so you can see the shape of a plan. Plans you
          make in the app use live Qloo data.
        </p>
        <div className="product-face bg-canvas px-3 pt-7 min-[700px]:px-[clamp(16px,3vw,32px)]">
          {detail ? (
            <OutputView
              key={current.id}
              detail={detail}
              initialTab={tab}
              canEdit={false}
              shared
              publicExample
            />
          ) : (
            <p className="pb-16 text-muted">This example could not load. Try again.</p>
          )}
        </div>
      </div>
      <Tooltip />
      <Toaster />
    </div>
  );
}
