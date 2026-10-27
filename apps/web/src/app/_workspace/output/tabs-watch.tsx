'use client';

import type {
  ActualsPreview,
  PaceState,
  UpdateWatch,
  WatchCadence,
  WatchEvent,
  WatchSeverity,
  WatchState,
} from '@oraqul/schema';
import { Button, Input, PacePill, SeverityPill } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { Dropdown } from '@/app/_components/dropdown';
import { ApiError } from '@/lib/api/http';
import { postMessage } from '@/lib/api/projects';
import {
  approveWatchEvent,
  deleteActual,
  dismissWatchEvent,
  markWatchRead,
  previewActuals,
  saveActuals,
  setWatchMuted,
  updatePace,
  updateWatch,
} from '@/lib/api/watch';
import { chatPath } from '@/lib/routes';
import { formatDay, plural } from '../format';
import { toast } from '../toast';
import { useOutputView } from './context';
import { Section, Stack, TabTitle } from './line';

const field =
  'w-full rounded-lg border border-line bg-surface px-3 py-[9px] text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45';

const CADENCE = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
] as const;

const SEVERITY = [
  { value: 'info', label: 'Everything', description: 'Info, watch and act' },
  { value: 'watch', label: 'Watch and act', description: 'The default' },
  { value: 'act', label: 'Act only', description: 'Only what needs a decision' },
] as const;

const APPROVE_LABEL: Partial<Record<WatchEvent['type'], string>> = {
  plan_stale: 'Check what has changed',
  pace_behind: 'Start a rescue',
};

const APPROVE_HELP: Partial<Record<WatchEvent['type'], string>> = {
  plan_stale: 'Asks Qloo and the web again. It counts against your runs this month.',
  pace_behind: 'Writes where to put the next seven days. It asks Qloo for nothing new.',
};

function whenWords(iso: string | null): string {
  return iso ? formatDay(iso) : 'not yet';
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) {
    return 'A run is already going in this plan’s chat. Try again when it finishes.';
  }
  return 'That did not work. Try again.';
}

/**
 * Launch Watch and the team's own figures. A watch re-checks the plan on a schedule and raises
 * events; it never changes the plan, and a run starts only when someone approves it. Figures are
 * the team's own and are read against the plan's pace by code, never forecast.
 */
export function WatchTab() {
  const { output, watch, canEdit, shared } = useOutputView();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const unread = watch?.unread ?? 0;

  // Opening the tab is what reads the events, so the count on the project clears.
  useEffect(() => {
    if (shared || unread === 0) return;
    void markWatchRead(output.id)
      .then(() => router.refresh())
      .catch(() => undefined);
  }, [shared, unread, output.id, router]);

  if (!watch) return null;
  const editable = canEdit && !shared;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      router.refresh();
    } catch (err) {
      toast(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  const on = watch.status === 'active';
  return (
    <>
      <TabTitle
        title="Watch"
        note="Oraqul re-checks this plan on a schedule and says what needs a look. Add your own figures to see whether the launch is ahead of, on or behind the plan’s pace. It never changes the plan."
      />
      <Controls
        watch={watch}
        editable={editable}
        busy={busy}
        onChange={(patch) => run(() => updateWatch(output.id, patch))}
        onMute={(muted) => run(() => setWatchMuted(output.id, muted))}
      />
      {watch.status === 'off' ? null : (
        <Section title="What the watch found">
          {watch.events.length === 0 ? (
            <p className="text-muted">
              {on
                ? 'Nothing yet. The first check runs soon, and an event appears here when one needs a look.'
                : 'The watch is paused.'}
            </p>
          ) : (
            <Stack>
              {watch.events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  editable={editable}
                  busy={busy}
                  onApprove={() => run(() => approveWatchEvent(output.id, event.id))}
                  onDismiss={() => run(() => dismissWatchEvent(output.id, event.id))}
                />
              ))}
            </Stack>
          )}
        </Section>
      )}
      <Pace pace={watch.pace} editable={editable} />
    </>
  );
}

function Controls({
  watch,
  editable,
  busy,
  onChange,
  onMute,
}: {
  watch: WatchState;
  editable: boolean;
  busy: boolean;
  onChange: (patch: UpdateWatch) => void;
  onMute: (muted: boolean) => void;
}) {
  const uid = useId();
  const on = watch.status === 'active';
  if (!watch.watchable) {
    return <p className="text-muted">Only a launch plan can be watched.</p>;
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-medium">
          {watch.status === 'off'
            ? 'The watch is off.'
            : on
              ? 'The watch is on.'
              : 'The watch is paused.'}
        </p>
        {editable ? (
          <Button
            variant={on ? 'default' : 'primary'}
            size="small"
            disabled={busy}
            onClick={() => onChange({ status: on ? 'paused' : 'active' })}
          >
            {on
              ? 'Pause the watch'
              : watch.status === 'off'
                ? 'Watch this launch'
                : 'Turn it back on'}
          </Button>
        ) : null}
      </div>
      {watch.status === 'off' ? (
        <p className="max-w-[62ch] text-[13.5px] text-muted">
          A watch checks rival release dates, campaign dates that slip, a plan that has grown old
          and your own figures. It never asks Qloo by itself, and it emails the team’s owners and
          editors.
        </p>
      ) : (
        <>
          <p className="text-[13.5px] text-muted">
            Last checked {whenWords(watch.lastCheckedAt)}. Next check {whenWords(watch.nextCheckAt)}
            .
          </p>
          {watch.notes.length > 0 ? (
            <ul className="flex list-disc flex-col gap-0.5 pl-5 text-[13.5px] text-muted">
              {watch.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          {editable ? (
            <div className="grid gap-3 min-[600px]:grid-cols-2">
              <Dropdown<WatchCadence>
                id={`${uid}-cadence`}
                label="How often"
                value={watch.cadence}
                onChange={(cadence) => onChange({ cadence })}
                options={[...CADENCE]}
                disabled={busy}
              />
              <Dropdown<WatchSeverity>
                id={`${uid}-severity`}
                label="Email me about"
                value={watch.minSeverity}
                onChange={(minSeverity) => onChange({ minSeverity })}
                options={[...SEVERITY]}
                disabled={busy}
              />
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-[13.5px]">
            <input
              type="checkbox"
              checked={watch.muted}
              disabled={busy}
              onChange={(e) => onMute(e.target.checked)}
            />
            Do not email me about this watch. Events still show here.
          </label>
        </>
      )}
    </div>
  );
}

function EventCard({
  event,
  editable,
  busy,
  onApprove,
  onDismiss,
}: {
  event: WatchEvent;
  editable: boolean;
  busy: boolean;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const approve = APPROVE_LABEL[event.type];
  return (
    <article
      className={`flex flex-col gap-2 rounded-xl border px-4 py-3.5 ${event.seen ? 'border-transparent bg-card' : 'border-accent/40 bg-accent-soft'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityPill severity={event.severity} />
        <h4 className="text-sm font-semibold">{event.title}</h4>
        {event.seen ? null : (
          <span className="rounded bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent">
            New
          </span>
        )}
      </div>
      <p className="max-w-[70ch] text-[13.5px]">{event.reason}</p>
      {event.evidence.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-[13px] text-muted">
          {event.evidence.map((s) => (
            <li key={s.url}>
              Source:{' '}
              <a
                className="text-accent underline underline-offset-2"
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.title}
              </a>
              , read on {formatDay(s.retrievedAt)}
              {s.quote ? <> · “{s.quote}”</> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[12.5px] text-muted">Raised {formatDay(event.createdAt)}</p>
      {event.status === 'open' && editable ? (
        <div className="flex flex-wrap items-center gap-2">
          {approve ? (
            <Button variant="primary" size="small" disabled={busy} onClick={onApprove}>
              {approve}
            </Button>
          ) : null}
          <Button size="small" variant="ghost" disabled={busy} onClick={onDismiss}>
            Dismiss
          </Button>
          {approve ? (
            <span className="text-[12.5px] text-muted">{APPROVE_HELP[event.type]}</span>
          ) : null}
        </div>
      ) : event.status === 'approved' ? (
        <p className="text-[13px] font-medium">
          Approved. Look in this plan’s chat for the result.
        </p>
      ) : event.status === 'dismissed' ? (
        <p className="text-[13px] text-muted">Dismissed</p>
      ) : null}
    </article>
  );
}

function curveShareText(share: number): string {
  return String(Math.round(share * 100));
}

function Pace({ pace, editable }: { pace: PaceState; editable: boolean }) {
  const { output } = useOutputView();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const result = pace.result;

  async function rescue() {
    setBusy(true);
    try {
      await postMessage(output.threadId, {
        kind: 'text',
        text: 'Rescue this launch.',
        attachments: [],
      });
      router.push(chatPath(output.threadId));
    } catch (err) {
      toast(messageFor(err));
      setBusy(false);
    }
  }

  if (!pace.available) {
    return (
      <Section title="Your figures">
        <p className="text-muted">{pace.unavailableReason}</p>
      </Section>
    );
  }
  return (
    <Section title="Your figures">
      <p className="max-w-[70ch] text-[13.5px] text-muted">
        Add what your launch has counted for {pace.signal.toLowerCase()}. Oraqul reads it against
        the plan’s pace and says if you are ahead, on pace or behind. It is direction, never a
        forecast.
      </p>
      {result ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-card px-5 py-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2.5">
            <PacePill verdict={result.verdict} />
            {result.gap !== null && result.gapPoints !== null ? (
              <b className="font-mono text-sm tabular-nums">
                {result.gap > 0 ? '+' : ''}
                {result.gap} {result.unit} ({result.gapPoints > 0 ? '+' : ''}
                {result.gapPoints} points of the target)
              </b>
            ) : null}
          </div>
          <p className="max-w-[70ch] text-[13.5px]">{explain(result)}</p>
          <p className="text-[12.5px] text-muted">{result.note}</p>
          {result.verdict === 'behind' && editable ? (
            <div className="flex items-center gap-3">
              <Button variant="primary" size="small" disabled={busy} onClick={rescue}>
                Start a rescue
              </Button>
              <span className="text-[12.5px] text-muted">
                Writes where to put the next seven days. You approve it by pressing the button.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {editable ? <AddFigures /> : null}
      <Entries pace={pace} editable={editable} />
      {editable ? <Settings pace={pace} /> : null}
    </Section>
  );
}

function explain(r: NonNullable<PaceState['result']>): string {
  const counted = `${plural(r.entries, 'dated entry', 'dated entries')} over ${plural(r.days, 'day')}`;
  if (r.verdict !== 'too-early') {
    return `By ${r.asOf ? formatDay(r.asOf) : 'now'} the plan’s pace puts the figures at ${r.expected} ${r.unit}. Yours are at ${r.actual}, from ${counted}.`;
  }
  switch (r.reason) {
    case 'no-target':
      return 'Set a target below so the figures have something to be read against.';
    case 'no-entries':
      return 'Add your first figures below.';
    case 'no-release-date':
      return 'This plan has no release date to read the figures against.';
    case 'few-entries':
      return `Three dated entries are needed before a read means anything. You have ${plural(r.entries, 'entry', 'entries')}.`;
    case 'before-first-checkpoint':
      return 'This signal is read from its first checkpoint on. Keep adding figures until then.';
    case 'low-expected':
      return 'The plan expects very little this early, so a comparison would say nothing yet.';
    default:
      return `From ${counted}.`;
  }
}

function AddFigures() {
  const { output } = useOutputView();
  const router = useRouter();
  const uid = useId();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ActualsPreview | null>(null);
  const [busy, setBusy] = useState(false);

  async function read(mapping: ActualsPreview['mapping'] = null, from = text) {
    if (!from.trim()) return;
    setBusy(true);
    try {
      setPreview(await previewActuals(output.id, from, mapping));
    } catch {
      toast('Could not read that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const body = await file.text();
    setText(body);
    await read(null, body);
  }

  async function save() {
    if (!preview?.rows.length) return;
    setBusy(true);
    try {
      await saveActuals(output.id, preview.rows);
      setText('');
      setPreview(null);
      toast(`Saved ${plural(preview.rows.length, 'row')}`);
      router.refresh();
    } catch {
      toast('Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const columns = preview?.columns ?? null;
  const mapping = preview?.mapping ?? null;
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-card px-5 py-4">
      <label htmlFor={`${uid}-paste`} className="text-[13px] font-medium">
        Add figures
      </label>
      <textarea
        id={`${uid}-paste`}
        rows={4}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
        placeholder={'2027-03-01, 120\n2027-03-02, 150, Lagos'}
        className={`${field} font-mono`}
      />
      <p className="text-[12.5px] text-muted">
        One line per day: the date, then what was counted that day, then a city and a channel if you
        have them. Write dates as 2027-03-12 or 12 Mar 2027. Or upload a CSV: only the columns you
        map are kept.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="small" disabled={busy || !text.trim()} onClick={() => read()}>
          Check the figures
        </Button>
        <label className="cursor-pointer text-[13px] font-medium text-accent underline underline-offset-2">
          Upload a CSV
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {columns && mapping ? (
        <div className="grid gap-2 min-[600px]:grid-cols-2">
          <Mapper
            uid={uid}
            label="Date column"
            value={mapping.date}
            columns={columns}
            onPick={(v) => read({ ...mapping, date: v })}
          />
          <Mapper
            uid={uid}
            label="Value column"
            value={mapping.value}
            columns={columns}
            onPick={(v) => read({ ...mapping, value: v })}
          />
          <Mapper
            uid={uid}
            label="City column"
            value={mapping.city}
            columns={columns}
            optional
            onPick={(v) => read({ ...mapping, city: v || null })}
          />
          <Mapper
            uid={uid}
            label="Channel column"
            value={mapping.channel}
            columns={columns}
            optional
            onPick={(v) => read({ ...mapping, channel: v || null })}
          />
        </div>
      ) : null}
      {preview ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-[13.5px]">
            {plural(preview.rows.length, 'row')} read
            {preview.errors.length
              ? `, ${plural(preview.errors.length, 'line')} could not be read`
              : ''}
            .
          </p>
          {preview.errors.length ? (
            <ul className="flex flex-col gap-0.5 text-[13px] text-breaks">
              {preview.errors.slice(0, 5).map((e) => (
                <li key={`${e.line}-${e.message}`}>
                  {e.line > 0 ? `Line ${e.line}: ` : ''}
                  {e.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <Button
              variant="primary"
              size="small"
              disabled={busy || preview.rows.length === 0}
              onClick={save}
            >
              Save {plural(preview.rows.length, 'row')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Mapper({
  uid,
  label,
  value,
  columns,
  optional,
  onPick,
}: {
  uid: string;
  label: string;
  value: string | null;
  columns: string[];
  optional?: boolean;
  onPick: (value: string) => void;
}) {
  const id = `${uid}-${label.replace(/\W/g, '')}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onPick(e.target.value)}
        className={field}
      >
        {optional ? <option value="">None</option> : null}
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

function Entries({ pace, editable }: { pace: PaceState; editable: boolean }) {
  const { output } = useOutputView();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (pace.entries.length === 0) return null;

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteActual(output.id, id);
      router.refresh();
    } catch {
      toast('Could not remove it. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const shown = [...pace.entries].reverse().slice(0, 30);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-medium">
        {plural(pace.entries.length, 'entry', 'entries')}
        {pace.entries.length > shown.length ? `, the latest ${shown.length} shown` : ''}
      </p>
      <ul className="flex flex-col gap-1 text-[13.5px]">
        {shown.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-lg bg-card px-3 py-1.5">
            <span className="w-16 text-muted">{formatDay(`${e.onDate}T00:00:00Z`)}</span>
            <b className="font-mono tabular-nums">{e.value}</b>
            <span className="text-muted">{[e.city, e.channel].filter(Boolean).join(' · ')}</span>
            {editable ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(e.id)}
                className="ml-auto text-[12.5px] text-muted underline underline-offset-2 hover:text-ink"
                aria-label={`Remove the figure for ${e.onDate}`}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Settings({ pace }: { pace: PaceState }) {
  const { output } = useOutputView();
  const router = useRouter();
  const uid = useId();
  const settings = pace.settings;
  const [target, setTarget] = useState(
    settings?.target === null ? '' : String(settings?.target ?? ''),
  );
  const [curve, setCurve] = useState(settings?.curve.map((p) => curveShareText(p.share)) ?? []);
  const [busy, setBusy] = useState(false);
  if (!settings) return null;

  async function save(body: Parameters<typeof updatePace>[1]) {
    setBusy(true);
    try {
      await updatePace(output.id, body);
      router.refresh();
    } catch {
      toast('Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const valid = curve.every((c) => c.trim() !== '' && Number(c) >= 0 && Number(c) <= 150);
  return (
    <details className="rounded-2xl bg-card px-5 py-4">
      <summary className="cursor-pointer text-[13.5px] font-medium">Target and pace</summary>
      <div className="mt-3 flex flex-col gap-3">
        <Input
          id={`${uid}-target`}
          label={`Target (${settings.unit})`}
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="small"
            disabled={busy || !(Number(target) > 0)}
            onClick={() => save({ target: Number(target) })}
          >
            Save the target
          </Button>
        </div>
        {settings.kind === 'cumulative' ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-medium">
              The pace: the share of the target expected by each day{' '}
              <span className="font-normal text-muted">
                ({settings.curveFrom === 'rule' ? 'Oraqul’s default' : 'edited by your team'})
              </span>
            </p>
            <p className="max-w-[70ch] text-[12.5px] text-muted">
              A convention, not a measured curve and not a forecast. Change it if you know your
              launch sells differently.
            </p>
            <div className="grid grid-cols-2 gap-2 min-[600px]:grid-cols-3">
              {settings.curve.map((point, i) => (
                <Input
                  key={point.day}
                  id={`${uid}-p${point.day}`}
                  label={`${Math.abs(point.day)} days ${point.day < 0 ? 'before' : point.day === 0 ? '(release day)' : 'after'}, %`}
                  inputMode="decimal"
                  value={curve[i] ?? ''}
                  onChange={(e) => setCurve((c) => c.map((v, j) => (j === i ? e.target.value : v)))}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="small"
                disabled={busy || !valid}
                onClick={() =>
                  save({
                    curve: settings.curve.map((p, i) => ({
                      day: p.day,
                      share: Number(curve[i]) / 100,
                    })),
                  })
                }
              >
                Save the pace
              </Button>
              {settings.curveFrom === 'team' ? (
                <Button
                  size="small"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => save({ resetCurve: true })}
                >
                  Use Oraqul’s default
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
