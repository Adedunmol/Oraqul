'use client';

import type { FindingMove, SourceMove } from '@oraqul/schema';
import { formatDay, plural } from '../format';
import { useOutputView } from './context';
import { Stack, TabTitle } from './line';

const ordinal = (n: number | null) => (n === null ? 'not listed' : `place ${n}`);
const figure = (n: number) => String(Math.round(n * 100) / 100);
const label = (key: string) => key.replace(/^lift /, '');

function Moved({ move }: { move: FindingMove }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl bg-card px-4 py-3">
      <p className="text-[15px]">{move.text}</p>
      <ul className="flex flex-col gap-0.5 text-[13.5px] text-muted">
        {move.numbers.map((n) => (
          <li key={n.key}>
            {label(n.key)}: {figure(n.before)} to {figure(n.after)}
          </li>
        ))}
        {move.ranks.map((r) => (
          <li key={r.name}>
            {r.name}: {ordinal(r.before)} to {ordinal(r.after)}
          </li>
        ))}
      </ul>
    </li>
  );
}

function Page({ move }: { move: SourceMove }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl bg-card px-4 py-3">
      <a
        href={move.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[15px] font-medium text-accent underline underline-offset-2"
      >
        {move.title}
      </a>
      {move.before ? <p className="text-[14px] text-muted">The plan saved: {move.before}</p> : null}
      {move.after ? <p className="text-[14px]">Now: {move.after}</p> : null}
      <p className="text-[12.5px] text-muted">
        {move.retrievedAt ? `Read on ${formatDay(move.retrievedAt)}` : 'Not found in this check'}
      </p>
    </li>
  );
}

/**
 * What a check found changed since the plan was made. The plan itself is not touched: this only sets
 * today's answers beside what it saved, and a revision is built when the person asks for one.
 */
export function RefreshTab() {
  const { output } = useOutputView();
  const refresh = output.refresh;
  if (!refresh) return null;
  const by = (status: FindingMove['status']) => refresh.findings.filter((f) => f.status === status);
  const pages = (status: SourceMove['status']) =>
    refresh.sources.filter((s) => s.status === status);
  const moved = by('moved');
  const fresh = by('new');
  const gone = by('not-returned');
  const changed = pages('changed');
  const newPages = pages('new');
  const missing = pages('not-found-again');
  const nothing = moved.length + changed.length === 0;
  return (
    <>
      <TabTitle
        title="What changed"
        note={`Checked on ${formatDay(refresh.checkedOn)} against the plan${refresh.planAsOf ? ` from ${formatDay(refresh.planAsOf)}` : ''}. Your plan is unchanged.`}
      />
      {refresh.question ? (
        <p className="text-[14px] text-muted">You asked: {refresh.question}</p>
      ) : null}
      <p className="max-w-[62ch]">
        {nothing
          ? 'Nothing the plan rests on moved in this check.'
          : `${plural(moved.length, 'finding')} moved and ${plural(changed.length, 'page')} changed.`}{' '}
        {fresh.length + newPages.length > 0
          ? `${fresh.length + newPages.length} newly found, which the plan has nothing to compare with.`
          : ''}
      </p>
      {moved.length > 0 ? (
        <Stack>
          <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em]">Moved</h3>
          <ul className="flex flex-col gap-2.5">
            {moved.map((m) => (
              <Moved key={m.findingId} move={m} />
            ))}
          </ul>
        </Stack>
      ) : null}
      {changed.length > 0 ? (
        <Stack>
          <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
            Pages that say something different
          </h3>
          <ul className="flex flex-col gap-2.5">
            {changed.map((s) => (
              <Page key={s.url} move={s} />
            ))}
          </ul>
        </Stack>
      ) : null}
      {refresh.affected.length > 0 ? (
        <Stack>
          <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
            Lines of your plan that rest on these
          </h3>
          <ul className="flex flex-col gap-1.5 text-[14.5px]">
            {refresh.affected.map((l) => (
              <li key={l.lineId}>
                {l.group ? <span className="text-muted">{l.group}: </span> : null}
                {l.text}
              </li>
            ))}
          </ul>
        </Stack>
      ) : null}
      {fresh.length + newPages.length > 0 ? (
        <Stack>
          <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em]">Newly found</h3>
          <ul className="flex flex-col gap-2.5">
            {fresh.map((m) => (
              <li key={m.findingId} className="rounded-xl bg-card px-4 py-3 text-[15px]">
                {m.text}
              </li>
            ))}
            {newPages.map((s) => (
              <Page key={s.url} move={s} />
            ))}
          </ul>
        </Stack>
      ) : null}
      {gone.length + missing.length > 0 ? (
        <p className="max-w-[62ch] text-[13.5px] text-muted">
          Not found again: {plural(gone.length, 'finding')} and {plural(missing.length, 'page')}.
          That is not a change. The check may simply have asked a little differently.
        </p>
      ) : null}
      {refresh.gaps.length > 0 ? (
        <Stack>
          <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
            What this check could not do
          </h3>
          <ul className="flex flex-col gap-1 text-[14px] text-muted">
            {refresh.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Stack>
      ) : null}
      <p className="max-w-[62ch] text-[14px] text-muted">
        To build a revision on today’s evidence, ask the chat to “Fix this plan”. Nothing is revised
        until you do.
      </p>
    </>
  );
}
