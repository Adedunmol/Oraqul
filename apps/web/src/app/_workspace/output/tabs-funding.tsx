'use client';

import type { Draft, Eligibility, FundingItem, FundingStatus, ProjectStage } from '@oraqul/schema';
import { Button, Input } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Dropdown } from '@/app/_components/dropdown';
import {
  approveFundingItem,
  confirmFundingSent,
  draftFundingItem,
  setProjectFacts,
  updateFundingItem,
} from '@/lib/api/funding';
import { postMessage } from '@/lib/api/projects';
import { mailtoLink, whatsappLink } from '@/lib/handoff';
import { chatPath } from '@/lib/routes';
import { formatDay, plural } from '../format';
import { toast } from '../toast';
import { useOutputView } from './context';
import { Section, TabTitle } from './line';

const field =
  'w-full rounded-lg border border-line bg-surface px-3 py-[9px] text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45';

const STATUS_WORD: Record<FundingStatus, string> = {
  found: 'Found',
  qualified: 'Worth pursuing',
  drafted: 'Drafted',
  approved: 'Approved',
  sent_by_you: 'Sent by you',
  replied: 'Replied',
  won: 'Won',
  lost: 'Lost',
};
const COLUMNS: FundingStatus[] = [
  'found',
  'qualified',
  'drafted',
  'approved',
  'sent_by_you',
  'replied',
  'won',
  'lost',
];

const MONEY: Record<string, string> = {
  cash: 'Cash',
  in_kind: 'In kind',
  placement: 'Placement',
  media: 'Media',
  bulk_tickets: 'Bulk tickets',
};

const STAGES: { value: ProjectStage | 'unset'; label: string }[] = [
  { value: 'unset', label: 'Not set' },
  { value: 'idea', label: 'Idea' },
  { value: 'development', label: 'Development' },
  { value: 'production', label: 'Production' },
  { value: 'post', label: 'Post production' },
  { value: 'released', label: 'Released or distributing' },
];

const ELIGIBILITY: Record<Eligibility['verdict'], { word: string; glyph: string; cls: string }> = {
  eligible: { word: 'Published criteria met', glyph: '✓', cls: 'bg-holds-bg text-holds' },
  check: { word: 'Check', glyph: '◐', cls: 'bg-weak-bg text-weak' },
  'not-eligible': { word: 'Not eligible', glyph: '✕', cls: 'bg-breaks-bg text-breaks' },
};

function EligibilityPill({ verdict }: { verdict: Eligibility['verdict'] }) {
  const { word, glyph, cls } = ELIGIBILITY[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-[9px] py-0.5 text-xs font-semibold ${cls}`}
    >
      <span aria-hidden="true">{glyph}</span>
      {word}
    </span>
  );
}

const daysLeft = (iso: string): number =>
  Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.now()) / 86_400_000);

/**
 * Sponsors that fit the plan's territories and funds that are open now, each with its source and
 * the day it was read, and a pipeline for each. Oraqul finds and drafts; a person approves, opens
 * the text in their own app, sends it and confirms. Nothing here sends anything.
 */
export function FundingTab() {
  const { output, funding, canEdit } = useOutputView();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!funding) return null;

  async function look() {
    setBusy(true);
    try {
      await postMessage(output.threadId, {
        kind: 'text',
        text: 'Find funding and sponsors.',
        attachments: [],
      });
      router.push(chatPath(output.threadId));
    } catch {
      toast('A run is already going in this plan’s chat, or it could not start. Try again.');
      setBusy(false);
    }
  }

  const sponsors = funding.items.filter((i) => i.kind === 'sponsor');
  const funds = funding.items.filter((i) => i.kind === 'fund');
  return (
    <>
      <TabTitle
        title="Funding and sponsors"
        note="Sponsors that fit each territory and funds that are open now, each with its source and the day it was read. Terms change: confirm on the source page before applying. Oraqul sends nothing."
      />
      {funding.status === 'none' ? <p className="text-muted">{funding.reason}</p> : null}
      {funding.status !== 'none' ? (
        <>
          <Facts />
          <div className="flex flex-col items-start gap-2 rounded-2xl bg-card px-5 py-4">
            <p className="max-w-[66ch]">
              {funding.status === 'ready'
                ? 'Find the brands Qloo ranks for your territories, with the sponsorships they have backed, and the funds, grants and programmes open to this project now.'
                : 'Look again for anything new. What you have done on each item is kept.'}
            </p>
            {!funding.canSearch ? (
              <p className="text-[13.5px] text-muted">
                Web search is not set up on this server, so only the sponsors Qloo ranked can be
                found, with no sponsorship evidence and no funds.
              </p>
            ) : null}
            {canEdit ? (
              <Button variant="primary" disabled={busy} onClick={() => void look()}>
                {funding.status === 'ready' ? 'Find funding and sponsors' : 'Look again'}
              </Button>
            ) : (
              <p className="text-[13.5px] text-muted">An editor can run this.</p>
            )}
          </div>
        </>
      ) : null}

      {funding.status === 'set' ? (
        <>
          <Section title="Sponsors">
            {sponsors.length === 0 ? (
              <p className="text-muted">No sponsor was found for these territories.</p>
            ) : (
              <SponsorTable items={sponsors} />
            )}
          </Section>
          <Section title="Funds, grants and programmes">
            {funds.length === 0 ? (
              <p className="text-muted">
                No open fund was found that a page confirms. Oraqul drops a result whose page does
                not hold its deadline or amount.
              </p>
            ) : (
              <FundTable items={funds} />
            )}
          </Section>
          <Deadlines items={funds} />
          <Section title="Pipeline">
            <Board items={funding.items} canEdit={canEdit} />
          </Section>
        </>
      ) : null}
    </>
  );
}

function Facts() {
  const { output, funding, canEdit } = useOutputView();
  const router = useRouter();
  const uid = useId();
  const [stage, setStage] = useState<ProjectStage | 'unset'>(funding?.facts.stage ?? 'unset');
  const [nationality, setNationality] = useState(funding?.facts.nationality ?? '');
  const [busy, setBusy] = useState(false);
  if (!funding) return null;

  async function save() {
    setBusy(true);
    try {
      await setProjectFacts(output.projectId, {
        stage: stage === 'unset' ? null : stage,
        nationality: nationality.trim() || null,
      });
      toast('Saved');
      router.refresh();
    } catch {
      toast('Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-2xl bg-card px-5 py-4" open={funding.status === 'ready'}>
      <summary className="cursor-pointer text-[13.5px] font-medium">
        What funds are compared with
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="max-w-[66ch] text-[13px] text-muted">
          A fund’s published criteria are compared with your plan’s category and territories, and
          with these two facts. Anything left blank shows as “Check”, never as met.
        </p>
        <div className="grid gap-3 min-[600px]:grid-cols-2">
          <Dropdown<ProjectStage | 'unset'>
            id={`${uid}-stage`}
            label="Stage of the work"
            value={stage}
            onChange={setStage}
            options={STAGES}
            disabled={!canEdit || busy}
          />
          <Input
            id={`${uid}-nat`}
            label="Nationality of the team"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="For example Nigerian"
            disabled={!canEdit || busy}
          />
        </div>
        {canEdit ? (
          <div>
            <Button size="small" disabled={busy} onClick={() => void save()}>
              Save
            </Button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function Source({ url, title, read }: { url: string; title: string; read: string }) {
  return (
    <span className="text-[13px]">
      <a
        className="text-accent underline underline-offset-2"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {title}
      </a>
      <span className="block text-muted">Found on {formatDay(read)}</span>
    </span>
  );
}

function SponsorTable({ items }: { items: FundingItem[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-card">
      <table className="w-full min-w-[640px] text-left text-[13.5px]">
        <thead className="text-[12.5px] text-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium">Sponsor</th>
            <th className="px-4 py-2.5 font-medium">Territory</th>
            <th className="px-4 py-2.5 font-medium">Could give</th>
            <th className="px-4 py-2.5 font-medium">Backed before</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((i) => (
            <tr key={i.id} className="align-top">
              <td className="px-4 py-3 font-medium">{i.name}</td>
              <td className="px-4 py-3">{i.territory}</td>
              <td className="px-4 py-3">{MONEY[i.sponsor?.moneyType ?? 'in_kind']}</td>
              <td className="px-4 py-3">
                {i.sponsor?.evidence ? (
                  <>
                    <span className="block max-w-[44ch]">“{i.sponsor.evidence.quote}”</span>
                    <Source
                      url={i.sponsor.evidence.url}
                      title={i.sponsor.evidence.title}
                      read={i.sponsor.evidence.retrievedAt}
                    />
                  </>
                ) : (
                  <span className="text-muted">No page found that says so</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FundTable({ items }: { items: FundingItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[70ch] text-[13px] text-muted">
        “Published criteria met” means the criteria Oraqul could read appear met by your plan. It is
        not a promise. Each row shows the page it came from: terms change, so confirm there before
        you apply. An amount or date the page does not state shows as unknown.
      </p>
      <div className="overflow-x-auto rounded-2xl bg-card">
        <table className="w-full min-w-[760px] text-left text-[13.5px]">
          <thead className="text-[12.5px] text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Fund</th>
              <th className="px-4 py-2.5 font-medium">Criteria</th>
              <th className="px-4 py-2.5 font-medium">Closes</th>
              <th className="px-4 py-2.5 font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((i) => {
              const f = i.fund;
              return (
                <tr key={i.id} className="align-top">
                  <td className="px-4 py-3">
                    <b className="font-medium">{i.name}</b>
                    <span className="block text-muted">
                      {[f?.owner, f?.type].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {f ? <EligibilityPill verdict={f.eligibility.verdict} /> : null}
                    {f?.eligibility.unknown.length ? (
                      <ul className="mt-1.5 list-disc pl-4 text-[12.5px] text-muted">
                        {f.eligibility.unknown.map((u) => (
                          <li key={u}>Unknown: {u}</li>
                        ))}
                      </ul>
                    ) : null}
                    {f?.eligibility.failed.length ? (
                      <ul className="mt-1.5 list-disc pl-4 text-[12.5px] text-breaks">
                        {f.eligibility.failed.map((u) => (
                          <li key={u}>Not met: {u}</li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {f?.deadline ? formatDay(`${f.deadline}T00:00:00Z`) : 'Unknown'}
                  </td>
                  <td className="px-4 py-3">{f?.amount ?? 'Unknown'}</td>
                  <td className="px-4 py-3">
                    {f ? (
                      <Source url={f.sourceUrl} title={f.sourceTitle} read={f.retrievedAt} />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Deadlines({ items }: { items: FundingItem[] }) {
  const dated = items
    .filter((i) => i.fund?.deadline && !['won', 'lost'].includes(i.status))
    .sort((a, b) => (a.fund?.deadline ?? '').localeCompare(b.fund?.deadline ?? ''));
  if (dated.length === 0) return null;
  return (
    <Section title="Deadlines">
      <ul className="flex flex-col gap-1.5">
        {dated.map((i) => {
          const days = daysLeft(i.fund?.deadline ?? '');
          return (
            <li
              key={i.id}
              className="flex flex-wrap items-center gap-x-3 rounded-lg bg-card px-4 py-2.5 text-[13.5px]"
            >
              <b className="font-medium">{i.name}</b>
              <span>{formatDay(`${i.fund?.deadline}T00:00:00Z`)}</span>
              <span className="text-muted">
                {days < 0 ? 'Closed' : days === 0 ? 'Today' : plural(days, 'day') + ' left'}
              </span>
              <span className="text-[12.5px] text-muted">Confirm on the source page</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function Board({ items, canEdit }: { items: FundingItem[]; canEdit: boolean }) {
  return (
    <div className="grid gap-3 min-[900px]:grid-cols-2 min-[1200px]:grid-cols-4">
      {COLUMNS.map((status) => {
        const here = items.filter((i) => i.status === status);
        return (
          <section
            key={status}
            aria-label={STATUS_WORD[status]}
            className="flex flex-col gap-2 rounded-2xl bg-inset p-3"
          >
            <h4 className="flex items-center justify-between text-[13px] font-semibold">
              {STATUS_WORD[status]}
              <span className="rounded bg-surface2 px-1.5 text-[12px] text-muted">
                {here.length}
              </span>
            </h4>
            {here.length === 0 ? (
              <p className="text-[12.5px] text-muted">None</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {here.map((i) => (
                  <li key={i.id}>
                    <ItemCard item={i} canEdit={canEdit} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ItemCard({ item, canEdit }: { item: FundingItem; canEdit: boolean }) {
  const { output } = useOutputView();
  const router = useRouter();
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState(item.note);
  const [follow, setFollow] = useState(item.nextFollowUpOn ?? '');

  async function run(action: () => Promise<void>, failed = 'That did not work. Try again.') {
    setBusy(true);
    try {
      await action();
      router.refresh();
    } catch {
      toast(failed);
    } finally {
      setBusy(false);
    }
  }

  const write = () =>
    run(async () => {
      const out = await draftFundingItem(output.id, item.id);
      setDraft(out.draft);
    });

  // Approving returns the checked text. The browser builds the link from a contact that stays on this
  // page, opens the person's own app, and the person sends it there.
  const approve = (via: 'email' | 'whatsapp') =>
    run(async () => {
      const link = (text: string, subject: string) =>
        via === 'email' ? mailtoLink(email, subject, text) : whatsappLink(phone, text);
      const probe = link('x', 'x');
      if (!probe) {
        toast(
          via === 'email'
            ? 'Type a valid email address first.'
            : 'Type a number with its country code first.',
        );
        return;
      }
      const out = await approveFundingItem(output.id, item.id);
      setDraft(out.draft);
      const url = link(out.draft.text, out.draft.subject);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }, 'Could not approve it. An owner may need to.');

  const sent = () =>
    run(async () => {
      await confirmFundingSent(output.id, item.id);
      toast('Marked as sent by you');
    });

  const patch = (body: Parameters<typeof updateFundingItem>[2]) =>
    run(async () => {
      await updateFundingItem(output.id, item.id, body);
    });

  const open = ['drafted', 'approved'].includes(item.status);
  return (
    <details className="rounded-xl bg-card px-3 py-2.5" open={open}>
      <summary className="cursor-pointer text-[13.5px] font-medium">
        {item.name}
        <span className="block text-[12px] font-normal text-muted">
          {item.kind === 'sponsor' ? item.territory : 'Fund'}
          {item.nextFollowUpOn
            ? ` · follow up ${formatDay(`${item.nextFollowUpOn}T00:00:00Z`)}`
            : ''}
        </span>
      </summary>
      <div className="mt-2.5 flex flex-col gap-2.5 text-[13px]">
        {canEdit && ['found', 'qualified', 'drafted'].includes(item.status) ? (
          <div className="flex flex-wrap gap-2">
            {item.status === 'found' ? (
              <Button
                size="small"
                disabled={busy}
                onClick={() => void patch({ status: 'qualified' })}
              >
                Worth pursuing
              </Button>
            ) : null}
            <Button size="small" variant="primary" disabled={busy} onClick={() => void write()}>
              {item.status === 'drafted' ? 'Write it again' : 'Write the draft'}
            </Button>
          </div>
        ) : null}

        {draft && ['drafted', 'approved'].includes(item.status) ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-draft`} className="text-[12.5px] font-medium">
              Draft ({draft.subject})
            </label>
            <textarea
              id={`${uid}-draft`}
              readOnly
              rows={9}
              value={draft.text}
              className={`${field} font-read leading-[1.5]`}
            />
          </div>
        ) : null}

        {canEdit && open ? (
          <div className="flex flex-col gap-2 rounded-lg bg-inset p-2.5">
            <p className="text-[12.5px] text-muted">
              Oraqul sends nothing. Type who it is for, and the text opens in your own app for you
              to send. The contact stays on this page.
            </p>
            <Input
              id={`${uid}-email`}
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id={`${uid}-phone`}
              label="WhatsApp number, with country code"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="small"
                variant="primary"
                disabled={busy}
                onClick={() => void approve('email')}
              >
                Approve and open my email
              </Button>
              <Button size="small" disabled={busy} onClick={() => void approve('whatsapp')}>
                Approve and open WhatsApp
              </Button>
            </div>
            {item.status === 'approved' ? (
              <div className="flex flex-col gap-1.5 border-t border-line pt-2">
                <p className="text-[12.5px] font-medium">Did you send it?</p>
                <div>
                  <Button size="small" disabled={busy} onClick={() => void sent()}>
                    Yes, I sent it
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {canEdit && ['sent_by_you', 'replied'].includes(item.status) ? (
          <div className="flex flex-wrap gap-2">
            {item.status === 'sent_by_you' ? (
              <Button
                size="small"
                disabled={busy}
                onClick={() => void patch({ status: 'replied' })}
              >
                They replied
              </Button>
            ) : null}
            <Button size="small" disabled={busy} onClick={() => void patch({ status: 'won' })}>
              Won
            </Button>
            <Button
              size="small"
              variant="ghost"
              disabled={busy}
              onClick={() => void patch({ status: 'lost' })}
            >
              Lost
            </Button>
          </div>
        ) : null}

        {canEdit && !['won', 'lost'].includes(item.status) ? (
          <div className="flex flex-col gap-2">
            <Input
              id={`${uid}-follow`}
              label="Next follow up"
              type="date"
              value={follow}
              onChange={(e) => setFollow(e.target.value)}
              onBlur={() => {
                if (follow !== (item.nextFollowUpOn ?? ''))
                  void patch({ nextFollowUpOn: follow || null });
              }}
            />
            <label htmlFor={`${uid}-note`} className="text-[12.5px] font-medium">
              Note
            </label>
            <textarea
              id={`${uid}-note`}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if (note !== item.note) void patch({ note });
              }}
              className={field}
            />
          </div>
        ) : item.note ? (
          <p className="text-muted">{item.note}</p>
        ) : null}
      </div>
    </details>
  );
}
