'use client';

import { Button } from '@oraqul/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/app/(app)/_components/modal';
import { saveDefaults } from '@/lib/api/rules';
import { toast } from './toast';

const neverKey = (teamId: string) => `oraqul:team-setup-never:${teamId}`;

/**
 * An optional popup for an owner whose team has written no defaults. It opens on every visit to
 * the page until the team saves some or the owner picks Don't show this again. It is the Team
 * defaults box, so what is typed here shows back there and is read the same way.
 */
export function TeamSetupDialog({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  // Never showing it again is a per-viewer convenience, so it lives in the browser.
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(neverKey(teamId)) !== '1');
    } catch {
      setOpen(true);
    }
  }, [teamId]);

  function never() {
    try {
      localStorage.setItem(neverKey(teamId), '1');
    } catch {
      // Closed for this visit only.
    }
    setOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await saveDefaults(teamId, text);
      toast('Saved. Edit this any time under Team defaults.');
      setOpen(false);
      router.refresh();
    } catch {
      toast('Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Help Oraqul plan for your team">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="setup-text" className="text-[13.5px] leading-[1.5] text-muted">
            Anything you'd like Oraqul to keep in mind when planning for you, such as where you are,
            where you launch, your budget or how you like to sound. Optional.
          </label>
          <textarea
            id="setup-text"
            rows={6}
            maxLength={6000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type something…"
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-[9px] text-sm leading-[1.55] text-ink placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy || text.trim() === ''}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Skip for now
          </Button>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-line pt-4 text-[12.5px] leading-[1.5] text-muted">
          <p>
            Nothing here is final. Change it any time in{' '}
            <Link
              href="/team/defaults"
              onClick={() => setOpen(false)}
              className="text-ink underline underline-offset-2"
            >
              Team defaults
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={never}
            className="self-start underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            Don't show this again
          </button>
        </div>
      </form>
    </Modal>
  );
}
