'use client';

import { type Category, categories, type StartMode } from '@oraqul/schema';
import { buttonClassName, ChipButton, Input } from '@oraqul/ui';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { startPath } from '@/lib/routes';
import {
  bands,
  buildBrief,
  CATEGORY_GUIDE,
  DETAILS,
  emptyValues,
  filled,
  launchers,
  type Values,
} from './brief';

const MODES: { mode: StartMode; title: string; brings: string }[] = [
  { mode: 'build', title: 'Make a plan', brings: 'Describe the launch' },
  { mode: 'audit', title: 'Check my plan', brings: 'Paste the plan you have' },
  { mode: 'fix', title: 'Fix my plan', brings: 'Paste the plan, and results if it is out' },
];

const field =
  'w-full rounded-lg border border-line bg-surface px-3 py-[9px] text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45';

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl bg-card p-5">
      <legend className="sr-only">{title}</legend>
      <div className="flex flex-col gap-0.5">
        <p className="font-display text-[17px] font-semibold tracking-[-0.02em]" aria-hidden="true">
          {title}
        </p>
        {note ? <p className="text-[13px] text-muted">{note}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

/**
 * Builds the brief that gets the best plan out of Oraqul, field by field, and shows which details
 * are still missing and why each one matters. Nothing is sent: it opens the app with the text.
 */
export function PromptBuilder() {
  const uid = useId();
  const [v, setV] = useState<Values>(() => emptyValues('film'));
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setV((p) => ({ ...p, [key]: value }));
  const guide = CATEGORY_GUIDE[v.category];
  const text = useMemo(() => buildBrief(v), [v]);
  const got = useMemo(() => filled(v), [v]);
  const count = DETAILS.filter((d) => got[d.id]).length;
  const checking = v.mode !== 'build';

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-6 min-[1000px]:grid-cols-[minmax(0,1fr)_380px] min-[1000px]:items-start">
      <div className="flex flex-col gap-4">
        <Group title="What do you want to do?">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <ChipButton
                key={m.mode}
                selected={v.mode === m.mode}
                onClick={() => set('mode', m.mode)}
              >
                {m.title}
              </ChipButton>
            ))}
          </div>
          <p className="text-[13px] text-muted">{MODES.find((m) => m.mode === v.mode)?.brings}.</p>
        </Group>

        <Group title="What kind of launch?">
          <div className="flex flex-wrap gap-2">
            {categories.map((c: Category) => (
              <ChipButton
                key={c}
                selected={v.category === c}
                onClick={() => setV((p) => ({ ...emptyValues(c), ...pick(p), category: c }))}
              >
                {CATEGORY_GUIDE[c].name}
              </ChipButton>
            ))}
          </div>
        </Group>

        <Group
          title="The launch"
          note="The title and a line on what it is. Add the country it comes from."
        >
          <Input
            id={`${uid}-title`}
            label="Title"
            value={v.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Night Ferry"
          />
          <Input
            id={`${uid}-about`}
            label="What it is, in a line"
            value={v.about}
            onChange={(e) => set('about', e.target.value)}
            placeholder="a thriller about a ferry crossing"
          />
          <Input
            id={`${uid}-country`}
            label="Country it comes from"
            value={v.country}
            onChange={(e) => set('country', e.target.value)}
            placeholder="United States"
          />
        </Group>

        <Group
          title="Date and places"
          note="Plans are worked back from the date. Name the home city first, then the other cities you want a plan for."
        >
          <Input
            id={`${uid}-release`}
            label={guide.dateLabel ?? 'Release date'}
            type="date"
            value={v.release}
            onChange={(e) => set('release', e.target.value)}
          />
          <Input
            id={`${uid}-cities`}
            label="Cities, home first"
            value={v.cities}
            onChange={(e) => set('cities', e.target.value)}
            placeholder="New York, Los Angeles, Atlanta, London"
          />
          <Input
            id={`${uid}-ages`}
            label="Who it is for"
            value={v.ages}
            onChange={(e) => set('ages', e.target.value)}
            placeholder="18 to 34 year olds"
          />
        </Group>

        <Group
          title={guide.compsLabel}
          note="Up to five titles your audience also likes. Three or more gives the strongest read."
        >
          <Input
            id={`${uid}-comps`}
            label={`${guide.compsLabel}, separated by commas`}
            value={v.comps}
            onChange={(e) => set('comps', e.target.value)}
            placeholder={guide.compsExample}
          />
        </Group>

        <Group
          title="Budget, who is launching and target"
          note={`Partners are sized to the budget and to who is launching. The plan is judged on one signal: ${guide.signal.toLowerCase()}. Give your own number, or leave it and see the benchmark where there is one.`}
        >
          <div
            role="radiogroup"
            aria-label="Budget band"
            className="grid gap-2 min-[560px]:grid-cols-2"
          >
            {bands.map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer flex-col items-start rounded-xl bg-surface2 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-surface2-hover has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent motion-reduce:transition-none"
              >
                <input
                  type="radio"
                  name={`${uid}-band`}
                  checked={v.band === b.id}
                  onChange={() => set('band', b.id)}
                  // A second click on the chosen band clears it, so the question can be left unanswered.
                  onClick={() => v.band === b.id && set('band', '')}
                  className="sr-only"
                />
                <b className="text-sm">{b.label}</b>
                <span className="text-xs text-muted">{b.hint}</span>
              </label>
            ))}
          </div>
          <div
            role="radiogroup"
            aria-label="Who is launching"
            className="grid gap-2 min-[560px]:grid-cols-2"
          >
            {launchers.map((l) => (
              <label
                key={l.id}
                className="flex cursor-pointer flex-col items-start rounded-xl bg-surface2 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-surface2-hover has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent motion-reduce:transition-none"
              >
                <input
                  type="radio"
                  name={`${uid}-launcher`}
                  checked={v.launcher === l.id}
                  onChange={() => set('launcher', l.id)}
                  onClick={() => v.launcher === l.id && set('launcher', '')}
                  className="sr-only"
                />
                <b className="text-sm">{l.label}</b>
                <span className="text-xs text-muted">{l.hint}</span>
              </label>
            ))}
          </div>
          <Input
            id={`${uid}-target`}
            label={`Target (${guide.unit})`}
            value={v.target}
            onChange={(e) => set('target', e.target.value)}
            placeholder="10,000"
            inputMode="numeric"
          />
        </Group>

        <Group
          title={`Rival ${guide.rivalLabel ?? 'releases'}`}
          note="Real rivals with the day each opens. Oraqul checks how much of your audience each one shares, and for a live show whether it falls on your night or week."
        >
          {v.rivals.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place and have no id
            <div key={i} className="grid gap-2 min-[560px]:grid-cols-[minmax(0,1fr)_170px]">
              <Input
                id={`${uid}-rt${i}`}
                label="Rival title"
                value={r.title}
                onChange={(e) =>
                  set(
                    'rivals',
                    v.rivals.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                  )
                }
              />
              <Input
                id={`${uid}-rd${i}`}
                label="Opens"
                type="date"
                value={r.date}
                onChange={(e) =>
                  set(
                    'rivals',
                    v.rivals.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)),
                  )
                }
              />
            </div>
          ))}
          {v.rivals.length < 3 ? (
            <button
              type="button"
              onClick={() => set('rivals', [...v.rivals, { title: '', date: '' }])}
              className="w-fit text-[13px] font-semibold text-accent hover:underline"
            >
              Add another rival
            </button>
          ) : null}
        </Group>

        <Group
          title="Already in place"
          note="Partners you have signed stay in the plan. Brands you know are asked of Qloo beside the ones Oraqul finds and proposes. The platforms you name are the ones the plan runs on."
        >
          <Input
            id={`${uid}-partners`}
            label="Partners already signed"
            value={v.partners}
            onChange={(e) => set('partners', e.target.value)}
            placeholder="Verizon"
          />
          <Input
            id={`${uid}-brands`}
            label="Brands you already know"
            value={v.brands}
            onChange={(e) => set('brands', e.target.value)}
            placeholder="A drinks brand, a bank"
          />
          <Input
            id={`${uid}-tone`}
            label="Content rating or tone"
            value={v.tone}
            onChange={(e) => set('tone', e.target.value)}
            placeholder="R, violent crime"
          />
          <Input
            id={`${uid}-channels`}
            label="Platforms to plan on"
            value={v.channels}
            onChange={(e) => set('channels', e.target.value)}
            placeholder="WhatsApp, Instagram"
          />
        </Group>

        <Group
          title={`${guide.name} details`}
          note="Only what you know. Anything you leave out is assumed, and the plan says what it assumed."
        >
          {guide.extras.map((x) => (
            <Input
              key={x.id}
              id={`${uid}-x-${x.id}`}
              label={x.label}
              value={v.extras[x.id] ?? ''}
              onChange={(e) => set('extras', { ...v.extras, [x.id]: e.target.value })}
              placeholder={x.placeholder}
            />
          ))}
        </Group>

        {checking ? (
          <Group
            title="Your plan"
            note="Paste it as written. Oraqul finds the beliefs it rests on and tests each one."
          >
            <label htmlFor={`${uid}-plan`} className="text-[13px] font-medium">
              The plan
            </label>
            <textarea
              id={`${uid}-plan`}
              rows={8}
              value={v.plan}
              onChange={(e) => set('plan', e.target.value)}
              className={`${field} font-read leading-[1.55]`}
            />
          </Group>
        ) : null}
      </div>

      <aside
        aria-label="Your brief"
        className="flex flex-col gap-4 min-[1000px]:sticky min-[1000px]:top-24"
      >
        <section className="flex flex-col gap-3 rounded-2xl bg-card p-5">
          <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em]">Your brief</h3>
          <pre className="font-read max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl bg-inset p-3.5 text-[14px] leading-[1.6]">
            {text || 'Fill in a field and the brief appears here.'}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Link
              href={startPath({ mode: v.mode, category: v.category, text })}
              className={buttonClassName('primary')}
            >
              Open in Oraqul
            </Link>
            <button type="button" onClick={copy} className={buttonClassName('default')}>
              {copied ? 'Copied' : 'Copy brief'}
            </button>
          </div>
          <p className="text-xs text-muted">
            Nothing is sent from this page. Opening it in Oraqul asks you to sign in.
          </p>
        </section>

        <section className="flex flex-col gap-2.5 rounded-2xl bg-card p-5" aria-live="polite">
          <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
            {count} of {DETAILS.length} details given
          </h3>
          <ul className="flex flex-col gap-1.5">
            {DETAILS.map((d) => (
              <li key={d.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-2 text-[13px]">
                <span aria-hidden="true" className={got[d.id] ? 'text-holds' : 'text-muted'}>
                  {got[d.id] ? '✓' : '◌'}
                </span>
                <span>
                  <b className="font-semibold">{d.label}</b>
                  <span className="sr-only">{got[d.id] ? ', given' : ', not given'}</span>
                  <span className="block text-muted">{d.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

// Switching category keeps what is true of any launch and drops what belongs to the old one.
function pick(p: Values): Partial<Values> {
  return {
    mode: p.mode,
    title: p.title,
    about: p.about,
    country: p.country,
    release: p.release,
    cities: p.cities,
    ages: p.ages,
    comps: p.comps,
    band: p.band,
    launcher: p.launcher,
    target: p.target,
    rivals: p.rivals,
    partners: p.partners,
    brands: p.brands,
    tone: p.tone,
    channels: p.channels,
    plan: p.plan,
  };
}
