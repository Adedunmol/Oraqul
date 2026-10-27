'use client';

import type { InviteSummary } from '@oraqul/schema';
import { Button, Chip } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api/http';
import { inviteMember, revokeInvite } from '@/lib/api/teams';
import { roleLabels } from '@/lib/roles';

function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'Too many invites sent. Try again later.';
  }
  return 'Something went wrong. Try again.';
}

/** A pending invite, with the two things an owner does to one: send it again or take it back. */
export function InviteRow({ teamId, invite }: { teamId: string; invite: InviteSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState('');

  async function run(action: () => Promise<unknown>, done: string) {
    setPending(true);
    setNote('');
    try {
      await action();
      setNote(done);
      router.refresh();
    } catch (caught) {
      setNote(messageFor(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-surface2 font-display text-[15px] font-semibold text-muted"
      >
        {invite.email.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1 basis-44">
        <p className="truncate text-sm font-semibold">{invite.email}</p>
        <p className="text-[13px] text-muted">
          {note ||
            `Expires ${new Date(invite.expiresAt).toLocaleDateString('en', { dateStyle: 'medium' })}`}
        </p>
      </div>
      <Chip>{roleLabels[invite.role]}</Chip>
      <div className="flex gap-2">
        <Button
          size="small"
          disabled={pending}
          onClick={() =>
            run(
              () => inviteMember(teamId, { email: invite.email, role: invite.role }),
              'Sent again.',
            )
          }
        >
          Resend
        </Button>
        <Button
          size="small"
          variant="danger"
          disabled={pending}
          onClick={() => run(() => revokeInvite(teamId, invite.id), 'Invite taken back.')}
        >
          Revoke
        </Button>
      </div>
    </li>
  );
}
