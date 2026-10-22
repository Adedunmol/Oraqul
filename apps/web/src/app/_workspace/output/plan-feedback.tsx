'use client';

import type { ReactionKind } from '@oraqul/schema';
import { Button } from '@oraqul/ui';
import { useState } from 'react';
import { setReaction } from '@/lib/api/projects';
import { toast } from '../toast';
import { FollowUp } from './plan-document';

const CHOICES: { kind: ReactionKind; label: string }[] = [
  { kind: 'useful', label: 'Useful' },
  { kind: 'wrong', label: 'Not right' },
];

/**
 * One question under the plan: was it useful? It is for the team's own review of what helps and
 * what is wrong, and it changes nothing in the plan. Pressing the chosen answer again takes it back.
 */
export function PlanFeedback({
  outputId,
  initial,
}: {
  outputId: string;
  initial: ReactionKind | null;
}) {
  const [chosen, setChosen] = useState<ReactionKind | null>(initial);
  const [saving, setSaving] = useState(false);

  async function choose(kind: ReactionKind) {
    const next = chosen === kind ? null : kind;
    const before = chosen;
    setChosen(next);
    setSaving(true);
    try {
      setChosen(await setReaction(outputId, next));
    } catch {
      setChosen(before);
      toast('Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FollowUp label="Rate this plan">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[14px] text-muted">Was this plan useful?</p>
        <div className="flex items-center gap-2">
          {CHOICES.map(({ kind, label }) => (
            <Button
              key={kind}
              size="small"
              variant={chosen === kind ? 'primary' : 'default'}
              aria-pressed={chosen === kind}
              disabled={saving}
              onClick={() => choose(kind)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </FollowUp>
  );
}
