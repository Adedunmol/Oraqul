'use client';

import {
  type DirectionCall,
  isLaterPartner as isLater,
  type LaunchLine,
  type LaunchPlan,
  type PartnerNote,
  type PartnerOption,
  type Territory,
  TIER_LABEL,
} from '@oraqul/schema';
import { Button, Confidence, DirectionPill, Input, ReceiptChip } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { setTeamPartners } from '@/lib/api/projects';
import { copyText, toast } from '../toast';
import { useOutputView } from './context';
import { Mark, Stack, TabTitle } from './line';
import { footnotes, LineText } from './plan-document';

const BUDGET: Record<PartnerOption['budgetFit'], string> = {
  fits: 'Fits this launch',
  stretch: 'A stretch for this launch',
  out: 'Not for this launch yet',
};

const ROLE: Record<Territory['role'], string> = {
  home: 'Home market',
  diaspora: 'Diaspora city',
  other: 'Market',
};

const FLAG_WORD: Record<PartnerOption['flags'][number]['type'], string> = {
  content: 'Content check',
  backlash: 'Backlash risk',
};

function PartnerRow({
  partner,
  onRemove,
}: {
  partner: PartnerOption;
  onRemove?: (name: string) => void;
}) {
  const { openReceipt } = useOutputView();
  const finding = partner.findingIds[0];
  const named = partner.kind === 'brand';
  return (
    <li className="flex flex-col gap-1 rounded-xl bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-sm">{partner.name}</b>
        <span className="text-[12.5px] text-muted">{partner.market}</span>
        {partner.from === 'team' ? <Mark>Your partner</Mark> : null}
        {partner.fit ? <DirectionPill direction={partner.fit.direction} /> : null}
        {finding ? (
          <ReceiptChip onClick={() => openReceipt(finding)} aria-label="Open receipt" />
        ) : null}
        {partner.from === 'team' && onRemove ? (
          <Button size="small" onClick={() => onRemove(partner.name)}>
            Remove {partner.name}
          </Button>
        ) : null}
      </div>
      <p className="text-[13px] text-muted">
        {named
          ? `${
              partner.fit
                ? `Qloo fit: ${partner.fit.place} of ${partner.fit.of} brands ranked for this audience${
                    partner.fit.local
                      ? `, and ${partner.fit.local.place} of ${partner.fit.local.of} for the city and age band alone`
                      : ''
                  }.`
                : partner.findingIds.length > 0
                  ? 'Qloo lists it, but too few brands were ranked to judge the fit.'
                  : partner.from === 'team'
                    ? 'Qloo fit: not ranked. Ask for a partner brief to score it.'
                    : 'Qloo fit: not ranked.'
            } `
          : 'A kind of partner, not a brand yet. '}
        {BUDGET[partner.budgetFit]}. Price: unknown.
      </p>
      {partner.flags.map((f) => (
        <p key={f.type + f.why} className="text-[13px] text-warn">
          <span aria-hidden="true">! </span>
          <b>{FLAG_WORD[f.type]}.</b> {f.why}
        </p>
      ))}
    </li>
  );
}

/** Add and remove the team's own partners. Saving recomputes the rows from the plan's findings. */
function TeamPartners({ partners }: { partners: PartnerOption[] }) {
  const { output, canEdit } = useOutputView();
  const router = useRouter();
  const field = useId();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const mine = partners.filter((p) => p.from === 'team').map((p) => p.name);
  if (!canEdit) return null;

  async function save(names: string[]) {
    setSaving(true);
    try {
      await setTeamPartners(output.id, names);
      setName('');
      router.refresh();
    } catch {
      toast('Could not save your partners. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const add = () => {
    const next = name.trim();
    if (!next || mine.some((m) => m.toLowerCase() === next.toLowerCase())) return;
    void save([...mine, next]);
  };

  return (
    <form
      className="flex flex-col gap-2 rounded-xl bg-card px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <Input
        id={field}
        label="Add a partner you already have or know"
        placeholder="A brand, venue or creator"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        disabled={saving}
        trailing={
          <Button size="small" type="submit" disabled={saving || !name.trim()}>
            Add
          </Button>
        }
      />
      <p className="text-[13px] text-muted">
        Your partners stay in the plan whatever the budget. A name Qloo did not rank shows as not
        ranked until you ask for a partner brief.
      </p>
    </form>
  );
}

/** Partners grouped by tier, flagship first, with the lead time notes. A tier with none is left out. */
export function PartnerTiers({
  partners,
  notes = [],
}: {
  partners: PartnerOption[];
  notes?: PartnerNote[];
}) {
  const { output, canEdit } = useOutputView();
  const router = useRouter();
  const mine = partners.filter((p) => p.from === 'team').map((p) => p.name);

  async function remove(name: string) {
    try {
      await setTeamPartners(
        output.id,
        mine.filter((m) => m !== name),
      );
      router.refresh();
    } catch {
      toast('Could not remove that partner. Try again.');
    }
  }

  if (partners.length === 0 && !canEdit) return null;
  return (
    <section aria-label="Partners by tier" className="flex flex-col gap-3">
      <h3 className="font-display text-base font-semibold tracking-[-0.02em]">Partners by tier</h3>
      {notes.length > 0 ? (
        <ul className="flex flex-col gap-1 text-[13px] text-muted">
          {notes.map((n) => (
            <li key={n.id}>{n.text}</li>
          ))}
        </ul>
      ) : null}
      {(['A', 'B', 'C'] as const).map((tier) => {
        const rows = partners.filter((p) => p.tier === tier && !isLater(p));
        if (rows.length === 0) return null;
        return (
          <div key={tier} className="flex flex-col gap-2">
            <h4 className="text-[13px] font-semibold">
              Tier {tier}, {TIER_LABEL[tier].name}
              <span className="ml-2 font-normal text-muted">{TIER_LABEL[tier].what}</span>
            </h4>
            <ul className="flex flex-col gap-2">
              {rows.map((p) => (
                <PartnerRow key={p.id} partner={p} onRemove={canEdit ? remove : undefined} />
              ))}
            </ul>
          </div>
        );
      })}
      {partners.some(isLater) ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-[13px] font-semibold">
            Later, as the launch grows
            <span className="ml-2 font-normal text-muted">
              Big brands plan years ahead and rarely back a launch like this. Treat them as a goal,
              not as part of this plan.
            </span>
          </h4>
          <ul className="flex flex-col gap-2">
            {partners.filter(isLater).map((p) => (
              <PartnerRow key={p.id} partner={p} onRemove={canEdit ? remove : undefined} />
            ))}
          </ul>
        </div>
      ) : null}
      <TeamPartners partners={partners} />
    </section>
  );
}

function linesOf(plan: LaunchPlan, ids: string[]): LaunchLine[] {
  const all = new Map(plan.sections.flatMap((s) => s.lines.map((l) => [l.id, l] as const)));
  return ids.flatMap((id) => all.get(id) ?? []);
}

/** One plan per territory: the home market first, then the diaspora cities. */
export function StructuredTerritories() {
  const { output, openReceipt } = useOutputView();
  const plan = output.plan;
  if (!plan) return null;
  const notes = footnotes(plan);
  return (
    <>
      <TabTitle title="Territories" />
      <Stack>
        {plan.territories.map((t) => {
          const call = plan.calls.find((c) => c.id === t.callId);
          const lead = t.channels.filter((c) => c.lead);
          const partners = plan.partners.filter((p) => t.partnerIds.includes(p.id));
          const lines = linesOf(plan, t.lineIds);
          return (
            <section
              key={t.id}
              aria-labelledby={t.id}
              className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-[18px]"
            >
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={t.id} className="font-display text-[17px] font-semibold tracking-[-0.02em]">
                  {t.order + 1}. {t.name}
                  <Mark>{ROLE[t.role]}</Mark>
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {call ? (
                    <>
                      <DirectionPill direction={call.direction} />
                      <Confidence level={call.confidence} />
                      <ReceiptChip
                        onClick={() => openReceipt(call.findingIds[0] ?? '')}
                        aria-label="Open receipt"
                      />
                    </>
                  ) : null}
                </div>
              </header>
              <p className="text-[13px] text-muted">
                {call
                  ? call.why
                  : 'Qloo could not rank this city for this audience, so it has no call.'}
              </p>
              <p className="text-[13px]">
                <span className="font-semibold">Lead on </span>
                {lead.map((c) => c.name).join(', ')}
                {t.channels.length > lead.length
                  ? `, then ${t.channels
                      .filter((c) => !c.lead)
                      .map((c) => c.name)
                      .join(', ')}`
                  : ''}
                .
              </p>
              {lines.length > 0 ? (
                <ul className="font-read flex flex-col gap-1.5 text-[15px] leading-[1.55]">
                  {lines.map((line) => (
                    <li key={line.id}>
                      <LineText
                        line={line}
                        notes={notes}
                        sources={plan.sources}
                        onSource={(id) => openReceipt(id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              {partners.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {partners.map((p) => (
                    <PartnerRow key={p.id} partner={p} />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </Stack>
      <PartnerTiers partners={plan.partners} notes={plan.partnerNotes} />
    </>
  );
}

const SUBJECT: Record<DirectionCall['subject'], string> = {
  date: 'Opening dates',
  territory: 'Territories',
  partner: 'Partners',
};

/** Okay, risky or avoid for every date, territory and partner, set by code. */
export function CallsTab() {
  const { output, openReceipt } = useOutputView();
  const calls = output.plan?.calls ?? [];
  return (
    <>
      <TabTitle
        title="Direction calls"
        note="A call on something you chose keeps your choice and says how to handle it. These are directions, not forecasts."
      />
      {calls.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-3.5 text-[14px] text-muted">
          No calls yet. Name rival releases with their dates, or plan for two or more cities, and
          Oraqul calls each one.
        </p>
      ) : null}
      {(['date', 'territory', 'partner'] as const).map((subject) => {
        const rows = calls.filter((c) => c.subject === subject);
        if (rows.length === 0) return null;
        return (
          <section key={subject} className="flex flex-col gap-2.5">
            <h3 className="font-display text-base font-semibold tracking-[-0.02em]">
              {SUBJECT[subject]}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {rows.map((c) => (
                <li
                  key={c.id}
                  className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl bg-card px-4 py-3.5 min-[900px]:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold">
                      {c.name}
                      {c.teamChoice ? <Mark>Your choice</Mark> : null}
                    </h4>
                    <p className="mt-0.5 text-[13px] text-muted">{c.why}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 min-[900px]:justify-end">
                    <DirectionPill direction={c.direction} />
                    <Confidence level={c.confidence} />
                    {c.findingIds[0] ? (
                      <ReceiptChip
                        onClick={() => openReceipt(c.findingIds[0] ?? '')}
                        aria-label="Open receipt"
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** The creative kit: guides for the team that makes the final creative. */
export function KitTab() {
  const { output, openReceipt } = useOutputView();
  const plan = output.plan;
  if (!plan) return null;
  const notes = footnotes(plan);
  const groups = [...new Set(plan.sections.flatMap((s) => s.lines.map((l) => l.group ?? '')))];
  return (
    <>
      <TabTitle
        title="Creative kit"
        note="Oraqul does not make the ad, trailer, image or video. A person does, from these guides."
      />
      {groups.map((group) => (
        <Stack key={group}>
          {group ? (
            <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em]">{group}</h3>
          ) : null}
          {plan.sections.map((s) => {
            const lines = s.lines.filter((l) => (l.group ?? '') === group);
            if (lines.length === 0) return null;
            return (
              <section
                key={s.key}
                className="flex flex-col gap-2.5 rounded-2xl bg-card px-5 py-[18px]"
              >
                <header className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">{s.title}</h4>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() =>
                      copyText(lines.map((l) => l.text).join('\n'), `${s.title} copied`)
                    }
                  >
                    Copy
                  </Button>
                </header>
                <ul className="font-read flex flex-col gap-1.5 text-[15px] leading-[1.55]">
                  {lines.map((line) => (
                    <li key={line.id}>
                      <LineText
                        line={line}
                        notes={notes}
                        sources={plan.sources}
                        onSource={(id) => openReceipt(id)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </Stack>
      ))}
    </>
  );
}
