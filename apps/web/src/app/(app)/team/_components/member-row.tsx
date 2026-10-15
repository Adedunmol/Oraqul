'use client';

import { type Member, type Role, roleSchema } from '@oraqul/schema';
import { Button, Chip } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Dropdown } from '@/app/_components/dropdown';
import { ApiError } from '@/lib/api/http';
import { changeMemberRole, removeMember } from '@/lib/api/teams';
import { roleHelp, roleLabels } from '@/lib/roles';

const roleOptions = roleSchema.options.map((role) => ({
  value: role,
  label: roleLabels[role],
  description: roleHelp[role],
}));

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'A team needs at least one owner.';
    if (error.status === 403) return 'Only owners can do that.';
    if (error.status === 404) return 'That person is no longer on the team.';
  }
  return 'Something went wrong. Try again.';
}

export function MemberRow({
  teamId,
  member,
  isMe,
  canManage,
}: {
  teamId: string;
  member: Member;
  isMe: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>, onDone: () => void) {
    setPending(true);
    setError('');
    try {
      await action();
      onDone();
    } catch (caught) {
      setError(messageFor(caught));
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  function changeRole(role: Role) {
    return run(
      () => changeMemberRole(teamId, member.userId, role),
      () => router.refresh(),
    );
  }

  function remove() {
    return run(
      () => removeMember(teamId, member.userId),
      () => {
        if (isMe) router.push('/team');
        router.refresh();
      },
    );
  }

  return (
    <li className="flex flex-col gap-2 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-[15px] font-semibold text-accent"
        >
          {member.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 basis-44">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="truncate">{member.name}</span>
            {isMe ? <Chip className="px-2 py-0 text-[11.5px] font-medium">You</Chip> : null}
          </p>
          <p className="truncate text-[13px] text-muted">{member.email}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              id={`role-${member.userId}`}
              label={`Role for ${member.name}`}
              hideLabel
              align="end"
              value={member.role}
              options={roleOptions}
              disabled={pending}
              onChange={changeRole}
              className="min-w-[7.5rem]"
            />
            {confirming ? (
              <>
                <Button
                  size="small"
                  variant="dangerSolid"
                  disabled={pending}
                  onClick={remove}
                  className="min-h-10 md:min-h-0"
                >
                  {isMe ? 'Yes, leave' : 'Yes, remove'}
                </Button>
                <Button
                  size="small"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="min-h-10 md:min-h-0"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="small"
                variant="danger"
                disabled={pending}
                onClick={() => setConfirming(true)}
                className="min-h-10 md:min-h-0"
              >
                {isMe ? 'Leave team' : 'Remove'}
              </Button>
            )}
          </div>
        ) : (
          <Chip>{roleLabels[member.role]}</Chip>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-breaks">
          {error}
        </p>
      ) : null}
    </li>
  );
}
