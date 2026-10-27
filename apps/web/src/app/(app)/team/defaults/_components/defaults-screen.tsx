'use client';

import type { Role, TeamRule } from '@oraqul/schema';
import { Button, Card, Chip } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from '@/app/_workspace/toast';
import { archiveRule, extractRules } from '@/lib/api/rules';

const field =
  'w-full rounded-lg border border-line bg-surface px-3 py-[9px] text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45';

// The lines Oraqul reads without guessing. A team can also write plain sentences such as "We don't
// welcome homophobic suggestions", which are kept as content rules.
const TEMPLATES: { label: string; line: string; note: string }[] = [
  {
    label: 'Market and territories',
    line: 'Markets: Lagos, London',
    note: 'Plans cover only these places, and use them when a brief names no city. Use "Never cover: Atlanta" to rule one out.',
  },
  {
    label: 'Budget ceiling and currency',
    line: 'Budget ceiling: £50k',
    note: 'No plan proposes spending more than this. A currency is needed.',
  },
  {
    label: 'Tone and language',
    line: 'Tone: warm, plain, no hype',
    note: 'Used when plans are written and checked. Add "Language: British English".',
  },
  {
    label: 'Brand safety',
    line: 'Brand safety: no alcohol or gambling brands',
    note: 'Used when plans are written and checked.',
  },
  {
    label: 'Banned partners and topics',
    line: 'Banned partners: Guinness',
    note: 'A banned partner is taken out before the plan is written. "Banned topics: politics" is a content rule.',
  },
  {
    label: 'Channels never used',
    line: 'Channels never used: Facebook',
    note: 'Left out of the content calendar.',
  },
  {
    label: 'Who must approve',
    line: 'Who must approve: owner',
    note: 'Anything that leaves Oraqul, such as a sponsor pitch, needs this role to approve it. Owner or editor.',
  },
];

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Paste what the team wants and save: Oraqul reads it into rules that every later run follows. Each
 * shows as a plain sentence beside the words it came from, and a rule that is not allowed is listed
 * with the reason. Owners and editors save; only an owner sets who must approve.
 */
export function DefaultsScreen({
  teamId,
  role,
  rules,
}: {
  teamId: string;
  role: Role;
  rules: TeamRule[];
}) {
  const router = useRouter();
  const uid = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  const isOwner = role === 'owner';
  const canSave = role !== 'viewer';

  const active = rules.filter((r) => r.status === 'active');
  const rejected = rules.filter((r) => r.status === 'rejected').slice(0, 10);

  async function run(action: () => Promise<unknown>, failed = 'That did not work. Try again.') {
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

  async function read() {
    setBusy(true);
    try {
      const out = await extractRules(teamId, { text, scope: 'team', projectId: null });
      setUnparsed(out.unparsed);
      setText('');
      const saved = out.rules.filter((r) => r.status === 'active').length;
      const refused = out.rules.length - saved;
      toast(
        out.rules.length === 0
          ? 'No rule found in that'
          : `Saved ${saved} ${saved === 1 ? 'rule' : 'rules'}${refused ? `, ${refused} not accepted` : ''}`,
      );
      router.refresh();
    } catch {
      toast('Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {canSave ? (
        <section
          aria-labelledby={`${uid}-paste`}
          className="grid items-start gap-5 min-[1000px]:grid-cols-[minmax(0,1fr)_340px]"
        >
          <Card className="flex flex-col gap-3 p-5">
            <h2
              id={`${uid}-paste`}
              className="font-display text-[16px] font-semibold tracking-[-0.01em]"
            >
              Paste your defaults
            </h2>
            <p className="text-[13px] text-muted">
              One rule a line, in your own words or the templates beside this. Save, and every plan
              for this team follows them from the next run.{' '}
              {isOwner ? '' : 'Only an owner can set who must approve.'}
            </p>
            <label htmlFor={`${uid}-text`} className="sr-only">
              Your defaults
            </label>
            <textarea
              id={`${uid}-text`}
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type something…"
              className={`${field} font-read leading-[1.55]`}
            />
            <div>
              <Button variant="primary" disabled={busy || !text.trim()} onClick={() => void read()}>
                Save my defaults
              </Button>
            </div>
            {unparsed.length ? (
              <div className="rounded-xl bg-inset px-4 py-3 text-[13px]">
                <p className="font-medium">Could not turn these into rules:</p>
                <ul className="mt-1 list-disc pl-5 text-muted">
                  {unparsed.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
                <p className="mt-1 text-muted">
                  Write them as a template line, such as “Tone: warm”.
                </p>
              </div>
            ) : null}
          </Card>
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em]">
                Templates
              </h2>
              <p className="text-[13px] text-muted">Tap one to add it.</p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {TEMPLATES.map((t) => (
                <li key={t.label}>
                  <button
                    type="button"
                    title={t.note}
                    onClick={() => setText((v) => (v ? `${v}\n${t.line}` : t.line))}
                    className="flex w-full flex-col items-start gap-0.5 rounded-lg bg-inset px-3 py-2 text-left transition-colors hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
                  >
                    <span className="text-[12.5px] text-muted">{t.label}</span>
                    <code className="text-[13px]">{t.line}</code>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : (
        <p className="text-muted">Viewers can read the team’s defaults but not change them.</p>
      )}

      <section aria-labelledby={`${uid}-active`} className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2
            id={`${uid}-active`}
            className="font-display text-[16px] font-semibold tracking-[-0.01em]"
          >
            What every plan follows
          </h2>
          <p className="text-[13px] text-muted">
            Each plan records the version of every rule it ran under. A replacement is a new
            version.
          </p>
        </div>
        {active.length === 0 ? (
          <p className="text-muted">
            No defaults yet. Plans follow Oraqul’s own rules only. Save some above.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((rule) => (
              <li key={rule.id}>
                <RuleCard rule={rule}>
                  <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
                    <span>
                      Version {rule.version}
                      {rule.confirmedAt ? `, saved ${when(rule.confirmedAt)}` : ''}
                    </span>
                    {canSave && (isOwner || rule.kind !== 'approval') ? (
                      <Button
                        size="small"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void run(() => archiveRule(teamId, rule.id))}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </RuleCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rejected.length ? (
        <section aria-labelledby={`${uid}-no`} className="flex flex-col gap-3">
          <h2
            id={`${uid}-no`}
            className="font-display text-[16px] font-semibold tracking-[-0.01em]"
          >
            Not accepted
          </h2>
          <ul className="flex flex-col gap-3">
            {rejected.map((rule) => (
              <li key={rule.id}>
                <Card className="flex flex-col gap-1.5 p-4">
                  <p className="text-[13.5px]">“{rule.sourceText}”</p>
                  <p className="text-[13px] text-muted">{rule.rejectionReason}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function RuleCard({ rule, children }: { rule: TeamRule; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[14.5px] font-medium">{rule.sentence}</p>
        <Chip>{rule.enforcement === 'code' ? 'Enforced in code' : 'Given to the writer'}</Chip>
        {rule.scope === 'project' ? <Chip>One project</Chip> : null}
      </div>
      <p className="text-[13px] text-muted">From: “{rule.sourceText}”</p>
      {rule.conflicts.length ? (
        <ul className="flex flex-col gap-0.5 rounded-xl bg-weak-bg px-3 py-2 text-[13px] text-weak">
          <li className="font-semibold">◐ Clashes with</li>
          {rule.conflicts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
      {children}
    </Card>
  );
}
