'use client';

import type { QuestionAnswer, ThreadItem } from '@oraqul/schema';
import { Button, Chip, Icon, Kbd } from '@oraqul/ui';
import { useState } from 'react';

type QuestionItem = Extract<ThreadItem, { role: 'question' }>;

const optionClass =
  'flex w-full items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left transition-colors duration-150 hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none';

/** Keeps a percent split at 100 when one value moves, spreading the rest in proportion. */
export function rebalance(values: number[], index: number, next: number): number[] {
  const value = Math.max(0, Math.min(100, Math.round(next)));
  const others = values.map((_, k) => k).filter((k) => k !== index);
  if (!others.length) return [100];
  const rest = 100 - value;
  const sum = others.reduce((s, k) => s + (values[k] ?? 0), 0);
  const out = values.slice();
  out[index] = value;
  for (const k of others) {
    out[k] =
      sum === 0 ? Math.floor(rest / others.length) : Math.floor(((values[k] ?? 0) / sum) * rest);
  }
  let missing = 100 - out.reduce((a, b) => a + b, 0);
  for (let n = 0; missing > 0; n++, missing--) {
    const k = others[n % others.length] ?? index;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * A question card. Once answered it folds to one quiet line with the answer, so the chat stays
 * about the work; the question opens on click. design-system §7.14
 */
export function QuestionCard({
  item,
  canEdit,
  isNew,
  onAnswer,
}: {
  item: QuestionItem;
  canEdit: boolean;
  isNew: boolean;
  onAnswer: (answer: QuestionAnswer) => void;
}) {
  const q = item.question;
  if (item.answer !== null) {
    return (
      <details className="group self-start rounded-lg text-[13px] text-muted">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-surface2 [&::-webkit-details-marker]:hidden">
          <Icon name="check" className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">
            Answered: <span className="text-ink">{item.answer}</span>
          </span>
          <Icon
            name="chevron"
            className="size-3.5 shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <p className="px-2 pt-1 pb-1.5">{q.prompt}</p>
      </details>
    );
  }
  return (
    <div
      aria-disabled={canEdit ? undefined : true}
      className={`flex flex-col gap-3 rounded-2xl bg-inset p-4 ${isNew ? 'item-new' : ''}`}
    >
      <p className="text-[15.5px] font-semibold">{q.prompt}</p>
      <Body item={item} canEdit={canEdit} onAnswer={onAnswer} />
    </div>
  );
}

function Body({
  item,
  canEdit,
  onAnswer,
}: {
  item: QuestionItem;
  canEdit: boolean;
  onAnswer: (answer: QuestionAnswer) => void;
}) {
  const q = item.question;
  switch (q.card) {
    case 'single':
    case 'match':
      return (
        <div className="flex flex-col gap-2">
          {q.options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              disabled={!canEdit}
              onClick={() => onAnswer({ card: 'options', optionIds: [o.id] })}
              className={optionClass}
            >
              <Kbd>{i + 1}</Kbd>
              <span>{o.label}</span>
              {o.description ? (
                <small className="ml-auto max-w-[55%] text-right text-[12.5px] text-muted">
                  {o.description}
                </small>
              ) : null}
            </button>
          ))}
        </div>
      );
    case 'multi':
      return <MultiBody options={q.options} canEdit={canEdit} onAnswer={onAnswer} />;
    case 'text':
      return (
        <TextBody hint={q.hint} attachments={q.attachments} canEdit={canEdit} onAnswer={onAnswer} />
      );
    case 'split':
      return (
        <SplitBody
          groups={q.split.groups}
          initial={q.split.values}
          canEdit={canEdit}
          onAnswer={onAnswer}
        />
      );
    case 'date':
      return <DateBody initial={q.defaultValue} canEdit={canEdit} onAnswer={onAnswer} />;
    case 'file':
      return (
        <FileBody
          dropLabel={q.dropLabel}
          altLabel={q.altLabel}
          canEdit={canEdit}
          onAnswer={onAnswer}
        />
      );
    case 'confirm':
      return <ConfirmBody question={q} canEdit={canEdit} onAnswer={onAnswer} />;
  }
}

type BodyProps = { canEdit: boolean; onAnswer: (answer: QuestionAnswer) => void };

function MultiBody({
  options,
  canEdit,
  onAnswer,
}: BodyProps & { options: { id: string; label: string; description?: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              disabled={!canEdit}
              onClick={() => setSelected((s) => (on ? s.filter((x) => x !== o.id) : [...s, o.id]))}
              className={`${optionClass} ${on ? 'border-accent/50! bg-accent-soft! text-ink' : ''}`}
            >
              <span>
                {on ? '✓ ' : ''}
                {o.label}
              </span>
              {o.description ? <small className="ml-auto text-muted">{o.description}</small> : null}
            </button>
          );
        })}
      </div>
      <div>
        <Button
          variant="primary"
          disabled={!canEdit || !selected.length}
          onClick={() => onAnswer({ card: 'options', optionIds: selected })}
        >
          Confirm
        </Button>
      </div>
    </>
  );
}

function TextBody({
  hint,
  attachments,
  canEdit,
  onAnswer,
}: BodyProps & { hint: string; attachments?: string[] }) {
  const [attached, setAttached] = useState<string[]>([]);
  return (
    <>
      <p className="text-[13px] text-muted">{hint}</p>
      {attachments ? (
        <div className="flex flex-wrap items-center gap-2">
          {attachments.map((name, i) => (
            <Button
              key={name}
              size="small"
              disabled={!canEdit}
              onClick={() => setAttached((a) => (a.includes(name) ? a : [...a, name]))}
            >
              {i === 0 ? 'Attach a plan' : 'Attach results'}
            </Button>
          ))}
          {attached.map((name) => (
            <Chip key={name}>{name}</Chip>
          ))}
        </div>
      ) : null}
      {attached.length ? (
        <div>
          <Button
            variant="primary"
            onClick={() => onAnswer({ card: 'attachments', names: attached })}
          >
            Continue with the attachment
          </Button>
        </div>
      ) : null}
    </>
  );
}

function SplitBody({
  groups,
  initial,
  canEdit,
  onAnswer,
}: BodyProps & { groups: string[]; initial: number[] }) {
  const [values, setValues] = useState(initial);
  return (
    <>
      <div className="flex flex-col gap-2.5">
        {groups.map((g, i) => (
          <div
            key={g}
            className="grid grid-cols-[90px_minmax(0,1fr)_40px] items-center gap-2.5 min-[900px]:grid-cols-[110px_minmax(0,1fr)_44px]"
          >
            <label htmlFor={`split-${g}`} className="text-[13px]">
              {g}
            </label>
            <input
              id={`split-${g}`}
              type="range"
              min={0}
              max={100}
              value={values[i] ?? 0}
              disabled={!canEdit}
              onChange={(e) => setValues((v) => rebalance(v, i, e.target.valueAsNumber))}
              className="w-full accent-accent"
            />
            <b className="font-mono text-xs tabular-nums">{values[i] ?? 0}%</b>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        The sliders always add up to 100. Moving one rebalances the others.
      </p>
      <div>
        <Button
          variant="primary"
          disabled={!canEdit}
          onClick={() => onAnswer({ card: 'split', values })}
        >
          Use this split
        </Button>
      </div>
    </>
  );
}

function DateBody({ initial, canEdit, onAnswer }: BodyProps & { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="date"
        aria-label="Date"
        value={value}
        disabled={!canEdit}
        onChange={(e) => setValue(e.target.value)}
        className="max-w-[200px] rounded-lg bg-card px-3 py-2 text-sm"
      />
      <Button
        variant="primary"
        disabled={!canEdit || !value}
        onClick={() => onAnswer({ card: 'date', value })}
      >
        Use this date
      </Button>
    </div>
  );
}

function FileBody({
  dropLabel,
  altLabel,
  canEdit,
  onAnswer,
}: BodyProps & { dropLabel: string; altLabel?: string }) {
  const [reading, setReading] = useState(false);
  if (reading) {
    return <div className="rounded-xl bg-card p-4 text-center text-muted">Reading the file…</div>;
  }
  return (
    <>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => {
          setReading(true);
          setTimeout(() => onAnswer({ card: 'file', name: 'the file' }), 900);
        }}
        className="w-full rounded-xl bg-card p-5 text-center text-muted transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {dropLabel}
      </button>
      <p className="text-xs text-muted">The file is simulated in this demo.</p>
      {altLabel ? (
        <div>
          <Button size="small" disabled={!canEdit} onClick={() => onAnswer({ card: 'alt' })}>
            {altLabel}
          </Button>
        </div>
      ) : null}
    </>
  );
}

type ConfirmQuestion = Extract<QuestionItem['question'], { card: 'confirm' }>;

function ConfirmBody({ question, canEdit, onAnswer }: BodyProps & { question: ConfirmQuestion }) {
  const [primary, setPrimary] = useState(question.primary.values);
  const [secondary, setSecondary] = useState(question.secondary?.values ?? null);
  const [hold, setHold] = useState(question.hold);
  const [error, setError] = useState('');
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

  function submit() {
    if (sum(primary) !== 100) {
      setError(
        `The ${question.primary.title.toLowerCase()} split adds to ${sum(primary)} percent. It must be 100.`,
      );
      return;
    }
    if (question.secondary && secondary && sum(secondary) !== 100) {
      setError(
        `The ${question.secondary.title.toLowerCase()} split adds to ${sum(secondary)} percent. It must be 100.`,
      );
      return;
    }
    onAnswer({ card: 'confirm', primary, secondary, hold });
  }

  return (
    <>
      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-[13px] min-[900px]:grid-cols-[150px_minmax(0,1fr)]">
        {question.rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted">{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      <SplitInputs
        title={question.primary.title}
        groups={question.primary.groups}
        values={primary}
        disabled={!canEdit}
        onChange={(v) => {
          setPrimary(v);
          setError('');
        }}
      />
      {question.secondary && secondary ? (
        <SplitInputs
          title={question.secondary.title}
          groups={question.secondary.groups}
          values={secondary}
          disabled={!canEdit}
          onChange={(v) => {
            setSecondary(v);
            setError('');
          }}
        />
      ) : null}
      <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {question.holdLabel}
        <input
          type="number"
          min={0}
          max={200}
          value={hold}
          disabled={!canEdit}
          onChange={(e) =>
            setHold(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)
          }
          className="w-16 rounded-md bg-card px-1.5 py-1 text-sm font-normal normal-case tracking-normal text-ink"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={!canEdit} onClick={submit}>
          These are right
        </Button>
        <span className="text-xs text-muted">
          Fix any number above first. Each split must add up to 100.
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-breaks">
          ✕ {error}
        </p>
      ) : null}
    </>
  );
}

function SplitInputs({
  title,
  groups,
  values,
  disabled,
  onChange,
}: {
  title: string;
  groups: string[];
  values: number[];
  disabled: boolean;
  onChange: (values: number[]) => void;
}) {
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {title} I read (percent)
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {groups.map((g, i) => (
          <label key={g} className="flex flex-col gap-1 text-xs text-muted">
            {g}
            <input
              type="number"
              min={0}
              max={100}
              value={values[i] ?? 0}
              disabled={disabled}
              onChange={(e) => {
                const next = values.slice();
                next[i] = Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber;
                onChange(next);
              }}
              className="w-16 rounded-md bg-card px-1.5 py-1 text-sm text-ink"
            />
          </label>
        ))}
        <span className={`font-semibold ${total === 100 ? 'text-holds' : 'text-breaks'}`}>
          {total === 100 ? '✓' : '✕'} {total} percent
        </span>
      </div>
    </div>
  );
}
