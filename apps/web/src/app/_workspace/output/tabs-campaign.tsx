'use client';

import type {
  ActionStatus,
  CampaignAction,
  CampaignSibling,
  CampaignTest,
  GuideLine,
  LaunchLine,
} from '@oraqul/schema';
import { Button, Input } from '@oraqul/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import {
  addCampaignTest,
  removeCampaignTest,
  setCampaignTestResults,
  setUpCampaign,
  updateCampaignAction,
} from '@/lib/api/projects';
import { outputPath } from '@/lib/routes';
import { formatDay, plural } from '../format';
import { toast } from '../toast';
import { useOutputView } from './context';
import { Stack, TabTitle } from './line';
import { footnotesOf, LineText } from './plan-document';

const STATUS: { value: ActionStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
];

const asLine = (l: GuideLine): LaunchLine => ({
  ...l,
  sourceIds: [],
  names: [],
  group: null,
});

function when(a: CampaignAction): string {
  if (!a.startsOn) return a.week === null ? 'No date' : `Week ${a.week}`;
  if (!a.endsOn || a.endsOn === a.startsOn) return formatDay(a.startsOn);
  return `${formatDay(a.startsOn)} to ${formatDay(a.endsOn)}`;
}

const GUIDE_TITLE = { hooks: 'Hooks', captions: 'Caption pack', keyart: 'Key art brief' } as const;

/**
 * The plan's content calendar as actions the team runs and ticks off. The set belongs to this
 * version of the plan: a revised plan has its own, and this one is never rewritten.
 */
export function CampaignTab() {
  const { output, campaign, canEdit } = useOutputView();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!campaign) return null;

  async function setUp() {
    setBusy(true);
    try {
      await setUpCampaign(output.id);
      router.refresh();
    } catch {
      toast('Could not set up the campaign. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const done = campaign.actions.filter((a) => a.status === 'done').length;
  const territories = [...new Set(campaign.actions.map((a) => a.territory ?? ''))];
  return (
    <>
      <TabTitle
        title="Campaign"
        note="The content calendar as actions your team can run, edit and tick off. Each comes with a guide to adapt: Oraqul makes no final asset."
      />
      <p className="text-[13.5px] text-muted">
        These actions belong to {output.label}. A revised plan gets its own set, and this one stays
        as you left it.
      </p>
      <Others others={campaign.others} />
      {campaign.status === 'none' ? (
        <p className="text-muted">{campaign.reason}</p>
      ) : campaign.status === 'ready' ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-card px-5 py-4">
          <p className="max-w-[62ch]">
            Turn this plan’s calendar into {plural(output.plan?.calendar.length ?? 0, 'action')},
            each with a guide from the creative kit.
          </p>
          {canEdit ? (
            <Button variant="primary" disabled={busy} onClick={setUp}>
              Set up the campaign
            </Button>
          ) : (
            <p className="text-[13.5px] text-muted">An editor can set this up.</p>
          )}
        </div>
      ) : (
        <>
          <p className="text-[13.5px] text-muted" aria-live="polite">
            {done} of {plural(campaign.actions.length, 'action')} done
          </p>
          {territories.map((territory) => (
            <Stack key={territory}>
              {territory ? (
                <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
                  {territory}
                </h3>
              ) : null}
              <ul className="flex flex-col gap-2.5">
                {campaign.actions
                  .filter((a) => (a.territory ?? '') === territory)
                  .map((action) => (
                    <li key={action.id}>
                      <ActionRow
                        action={action}
                        test={campaign.tests.find((t) => t.actionId === action.id) ?? null}
                      />
                    </li>
                  ))}
              </ul>
            </Stack>
          ))}
        </>
      )}
    </>
  );
}

function Others({ others }: { others: CampaignSibling[] }) {
  if (others.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-[13.5px] text-muted">
      {others.map((o) => (
        <li key={o.outputId}>
          Another version has its own set:{' '}
          <Link
            className="text-accent underline underline-offset-2"
            href={outputPath(o.outputId, 'campaign')}
          >
            {o.title}
          </Link>
          , {o.done} of {plural(o.actions, 'action')} done.
        </li>
      ))}
    </ul>
  );
}

function ActionRow({ action, test }: { action: CampaignAction; test: CampaignTest | null }) {
  const { output, canEdit, openReceipt } = useOutputView();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    title: action.title,
    channel: action.channel,
    startsOn: action.startsOn ?? '',
    note: action.note,
  });
  const base = useId();

  async function save(patch: Parameters<typeof updateCampaignAction>[2]) {
    setBusy(true);
    try {
      await updateCampaignAction(output.id, action.id, patch);
      setEditing(false);
      router.refresh();
    } catch {
      toast('Could not save that change. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const lines = action.guide?.lines.map(asLine) ?? [];
  const notes = footnotesOf(lines);
  const done = action.status === 'done';
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            {when(action)} · {action.channel}
          </p>
          <p className={`text-[15px] font-medium ${done ? 'text-muted line-through' : ''}`}>
            {action.title}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Playbook{action.edited ? ' · Edited by your team' : ''}
          </p>
        </div>
        <fieldset className="m-0 flex min-w-0 gap-1 border-0 p-0">
          <legend className="sr-only">Status of {action.title}</legend>
          {STATUS.map((s) => (
            <button
              key={s.value}
              type="button"
              disabled={!canEdit || busy}
              aria-pressed={action.status === s.value}
              onClick={() => save({ status: s.value })}
              className={`h-8 rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 motion-reduce:transition-none ${action.status === s.value ? 'bg-accent text-primary-ink' : 'bg-surface2 text-ink hover:bg-line'}`}
            >
              {s.label}
            </button>
          ))}
        </fieldset>
      </div>
      {action.note && !editing ? <p className="text-[14px] text-ink/80">{action.note}</p> : null}
      {action.guide ? (
        <details className="group">
          <summary className="cursor-pointer text-[13.5px] font-medium text-accent">
            {GUIDE_TITLE[action.guide.kind]}, a guide to adapt
          </summary>
          <ul className="font-read mt-2 flex flex-col gap-1.5 text-[14.5px] leading-[1.55]">
            {lines.map((line) => (
              <li key={line.id}>
                <LineText
                  line={line}
                  notes={notes}
                  sources={[]}
                  onSource={(id) => openReceipt(id)}
                />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {test ? <TestCard actionId={action.id} test={test} canEdit={canEdit} /> : null}
      {editing ? (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <Input
            id={`${base}-title`}
            label="What to post"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <div className="grid gap-3 min-[600px]:grid-cols-2">
            <Input
              id={`${base}-channel`}
              label="Channel"
              value={draft.channel}
              onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
            />
            <Input
              id={`${base}-date`}
              label="Starts on"
              type="date"
              value={draft.startsOn}
              onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })}
            />
          </div>
          <Input
            id={`${base}-note`}
            label="Note"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="small"
              disabled={busy || draft.title.trim() === '' || draft.channel.trim() === ''}
              onClick={() =>
                save({
                  title: draft.title,
                  channel: draft.channel,
                  startsOn: draft.startsOn || null,
                  // A moved start date drops the old end, so the span never ends before it starts.
                  ...(draft.startsOn !== (action.startsOn ?? '') ? { endsOn: null } : {}),
                  note: draft.note,
                })
              }
            >
              Save
            </Button>
            <Button size="small" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button size="small" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {!test && action.territory ? <TestButton actionId={action.id} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function TestButton({ actionId }: { actionId: string }) {
  const { output } = useOutputView();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="small"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await addCampaignTest(output.id, actionId);
          router.refresh();
        } catch {
          toast('Could not set up the test. Try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      Set up a two-angle test
    </Button>
  );
}

/** Two angles, each with why, and the one thing to measure. Oraqul does not say which wins. */
function TestCard({
  actionId,
  test,
  canEdit,
}: {
  actionId: string;
  test: CampaignTest;
  canEdit: boolean;
}) {
  const { output, openReceipt } = useOutputView();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const lines: LaunchLine[] = test.angles.map((a) => ({
    id: `${test.id}-${a.id}`,
    kind: a.basis,
    text: a.text,
    findingIds: a.findingIds,
    sourceIds: [],
    names: [],
    group: null,
  }));
  const notes = footnotesOf(lines);
  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-bg px-4 py-3">
      <p className="text-[13.5px] font-medium">Two-angle test</p>
      <ul className="flex flex-col gap-2">
        {test.angles.map((angle, i) => (
          <li key={angle.id} className="text-[14.5px] leading-[1.55]">
            <span className="font-medium">{angle.label}.</span>{' '}
            {lines[i] ? (
              <LineText
                line={lines[i]}
                notes={notes}
                sources={[]}
                onSource={(id) => openReceipt(id)}
              />
            ) : null}
            <span className="ml-1.5 text-[12.5px] text-muted">
              {angle.basis === 'grounded' ? 'Grounded in your audience’s taste' : 'Playbook'}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[14.5px] leading-[1.55]">
        <span className="font-medium">Measure.</span> {test.measure}
      </p>
      <ul className="flex flex-col gap-0.5 text-[13.5px] text-muted">
        {test.conventions.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <TestFigures actionId={actionId} test={test} canEdit={canEdit} />
      <p className="text-[13.5px] text-muted">Oraqul does not predict which angle will win.</p>
      {canEdit ? (
        <div>
          <Button
            size="small"
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await removeCampaignTest(output.id, actionId);
                router.refresh();
              } catch {
                toast('Could not remove the test. Try again.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Remove the test
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const VERDICT_WORD = {
  'a-ahead': 'Angle A is ahead',
  'b-ahead': 'Angle B is ahead',
  inconclusive: 'Inconclusive',
} as const;

/**
 * The team's own figures for the two angles, and the comparison code makes from them. These are the
 * team's numbers, not Qloo's: a taste score is never read as a result.
 */
function TestFigures({
  actionId,
  test,
  canEdit,
}: {
  actionId: string;
  test: CampaignTest;
  canEdit: boolean;
}) {
  const { output } = useOutputView();
  const router = useRouter();
  const base = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    measure: test.results?.measure ?? 'conversions',
    a: String(test.results?.a ?? ''),
    b: String(test.results?.b ?? ''),
    period: test.results?.period ?? '',
    source: test.results?.source ?? '',
  });
  const valid =
    draft.measure.trim() !== '' &&
    draft.a.trim() !== '' &&
    draft.b.trim() !== '' &&
    Number(draft.a) >= 0 &&
    Number(draft.b) >= 0;

  async function save() {
    setBusy(true);
    try {
      await setCampaignTestResults(output.id, actionId, {
        measure: draft.measure,
        a: Number(draft.a),
        b: Number(draft.b),
        period: draft.period.trim() || null,
        source: draft.source.trim() || null,
      });
      setOpen(false);
      router.refresh();
    } catch {
      toast('Could not save those figures. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2.5">
      {test.results ? (
        <>
          <p className="text-[14.5px] leading-[1.55]">
            <span className="font-medium">Your figures.</span> Angle A {test.results.a}, angle B{' '}
            {test.results.b} {test.results.measure}
            {test.results.period ? `, ${test.results.period}` : ''}
            {test.results.source ? `. Source: ${test.results.source}` : ''}.
          </p>
          {test.comparison ? (
            <p className="text-[14.5px] leading-[1.55]">
              <span className="font-medium">{VERDICT_WORD[test.comparison.verdict]}.</span>{' '}
              {test.comparison.why}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[13.5px] text-muted">
          Add the figures you measured for each angle and Oraqul compares them.
        </p>
      )}
      {canEdit && !open ? (
        <div>
          <Button size="small" variant="ghost" onClick={() => setOpen(true)}>
            {test.results ? 'Change the figures' : 'Add the figures'}
          </Button>
        </div>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 min-[600px]:grid-cols-3">
            <Input
              id={`${base}-measure`}
              label="What you counted"
              value={draft.measure}
              onChange={(e) => setDraft({ ...draft, measure: e.target.value })}
            />
            <Input
              id={`${base}-a`}
              label="Angle A"
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.a}
              onChange={(e) => setDraft({ ...draft, a: e.target.value })}
            />
            <Input
              id={`${base}-b`}
              label="Angle B"
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.b}
              onChange={(e) => setDraft({ ...draft, b: e.target.value })}
            />
          </div>
          <div className="grid gap-3 min-[600px]:grid-cols-2">
            <Input
              id={`${base}-period`}
              label="Period (optional)"
              value={draft.period}
              onChange={(e) => setDraft({ ...draft, period: e.target.value })}
            />
            <Input
              id={`${base}-source`}
              label="Source (optional)"
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="small" disabled={busy || !valid} onClick={save}>
              Save
            </Button>
            <Button size="small" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
