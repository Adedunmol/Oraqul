'use client';

import type { Role, SavedDefaults, TeamRule } from '@oraqul/schema';
import { Button, Card } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from '@/app/_workspace/toast';
import { saveDefaults } from '@/lib/api/rules';

const field =
  'w-full rounded-lg border border-line bg-surface px-3 py-[9px] text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45';

// A few ways to start. Each adds one line to the box, which a team can then rewrite in its own words.
const IDEAS: { label: string; line: string }[] = [
  { label: 'Markets', line: 'Markets: Lagos, London' },
  { label: 'Budget ceiling', line: 'Budget ceiling: £50k' },
  { label: 'Tone', line: 'Tone: warm, plain, no hype' },
  { label: 'Brand safety', line: 'Brand safety: no alcohol or gambling brands' },
  { label: 'Banned partners', line: 'Banned partners: Guinness' },
  { label: 'Channels to skip', line: 'Channels never used: Facebook' },
  { label: 'Who approves', line: 'Who must approve: owner' },
];

type Notes = Pick<SavedDefaults, 'notAccepted' | 'unparsed'>;

/**
 * What every plan for the team follows, written in the team's own words. The box always holds what
 * was saved; saving works out the rules from it and they apply from the next run. Below it, in plain
 * sentences, is what Oraqul took from it.
 */
export function DefaultsScreen({
  teamId,
  role,
  text: saved,
  rules,
}: {
  teamId: string;
  role: Role;
  text: string;
  rules: TeamRule[];
}) {
  const router = useRouter();
  const uid = useId();
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Notes | null>(null);
  const canSave = role !== 'viewer';
  const changed = text.trim() !== saved.trim();

  async function save() {
    setBusy(true);
    try {
      const out = await saveDefaults(teamId, text);
      setText(out.text);
      setNotes({ notAccepted: out.notAccepted, unparsed: out.unparsed });
      toast('Saved');
      router.refresh();
    } catch {
      toast('Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col gap-3 p-5">
        <label
          htmlFor={`${uid}-text`}
          className="font-display text-[16px] font-semibold tracking-[-0.01em]"
        >
          What should every plan follow?
        </label>
        <textarea
          id={`${uid}-text`}
          rows={9}
          value={text}
          readOnly={!canSave}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something…"
          className={`${field} font-read leading-[1.55]`}
        />
        {canSave ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((i) => (
                <button
                  key={i.label}
                  type="button"
                  title={i.line}
                  onClick={() => setText((v) => (v.trim() ? `${v.trimEnd()}\n${i.line}` : i.line))}
                  className="rounded-full bg-inset px-3 py-1 text-[12.5px] text-muted transition-colors hover:bg-surface2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
                >
                  + {i.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="primary" disabled={busy || !changed} onClick={() => void save()}>
                Save
              </Button>
              {role === 'owner' ? null : (
                <span className="text-[12.5px] text-muted">
                  Only an owner can set who approves.
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted">Only owners and editors can change these.</p>
        )}
        {notes && (notes.notAccepted.length > 0 || notes.unparsed.length > 0) ? (
          <div
            className="flex flex-col gap-2 rounded-xl bg-inset px-4 py-3 text-[13px]"
            role="status"
          >
            {notes.notAccepted.map((n) => (
              <p key={n.text}>
                <b className="font-medium">Left out:</b> “{n.text}”.{' '}
                <span className="text-muted">{n.reason}</span>
              </p>
            ))}
            {notes.unparsed.length > 0 ? (
              <p>
                <b className="font-medium">Not sure what to do with:</b>{' '}
                {notes.unparsed.map((l) => `“${l}”`).join(', ')}.{' '}
                <span className="text-muted">Try saying it more plainly.</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <section aria-labelledby={`${uid}-now`} className="flex flex-col gap-3">
        <h2 id={`${uid}-now`} className="font-display text-[16px] font-semibold tracking-[-0.01em]">
          What Oraqul will follow
        </h2>
        {rules.length === 0 ? (
          <p className="text-muted">
            Nothing yet. Write what every plan should follow above, then save.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-col gap-0.5">
                <span className="text-[14.5px]">{rule.sentence}</span>
                {rule.conflicts.map((c) => (
                  <span key={c} className="text-[13px] text-weak">
                    Heads up: {c}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
