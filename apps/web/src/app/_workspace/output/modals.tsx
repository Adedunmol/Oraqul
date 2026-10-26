'use client';

import { Button, buttonClassName, Chip, Icon } from '@oraqul/ui';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { ConfirmDialog } from '@/app/(app)/_components/confirm-dialog';
import { Modal } from '@/app/(app)/_components/modal';
import { setShare } from '@/lib/api/projects';
import { copyText, toast } from '../toast';

const subscribeNoop = () => () => {};

/** Turns the read only link for one output on or off. */
export function ShareModal({
  open,
  onClose,
  share,
}: {
  open: boolean;
  onClose: () => void;
  share: { outputId: string; token: string | null; enabled: boolean };
}) {
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [link, setLink] = useState({ token: share.token, enabled: share.enabled });
  const [saving, setSaving] = useState(false);
  // The origin is only known in the browser; the server render shows the path alone.
  const origin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => '',
  );
  const url = `${origin}/s/${link.token}`;

  async function turn(enabled: boolean) {
    setSaving(true);
    try {
      setLink(await setShare(share.outputId, enabled));
    } catch {
      toast(
        enabled
          ? 'The link was not turned on. Try again.'
          : 'The link was not turned off. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Share this output">
      <p className="text-muted">
        A read only link to one output. Anyone with it can read the output and open a summary of its
        evidence. They cannot edit, see other outputs or see the rest of your team&apos;s projects,
        and the raw Qloo data stays with your team.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Chip>{link.enabled ? 'Link is on' : 'Link is off'}</Chip>
        {link.enabled ? (
          <Button icon="close" disabled={saving} onClick={() => setConfirmingOff(true)}>
            Turn link off
          </Button>
        ) : (
          <Button icon="share" disabled={saving} onClick={() => void turn(true)}>
            Turn link on
          </Button>
        )}
      </div>
      {link.enabled && link.token ? (
        <>
          <code className="block break-all rounded-lg bg-surface2 px-3 py-2.5 font-mono text-xs">
            {url}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon="copy" onClick={() => copyText(url, 'Link copied')}>
              Copy link
            </Button>
            <Link
              href={`/s/${link.token}`}
              className={buttonClassName('default', 'default', 'icon')}
            >
              <Icon name="external" className="size-4" />
              Open shared view
            </Link>
          </div>
        </>
      ) : link.token ? (
        <p className="text-muted">The old link no longer works.</p>
      ) : null}
      <ConfirmDialog
        open={confirmingOff}
        onClose={() => setConfirmingOff(false)}
        title="Turn this link off?"
        confirmLabel="Turn link off"
        confirmIcon="close"
        onConfirm={() => {
          void turn(false);
          setConfirmingOff(false);
        }}
      >
        <p>Anyone using the link loses access straight away.</p>
        <p>You can turn it on again later.</p>
      </ConfirmDialog>
    </Modal>
  );
}
