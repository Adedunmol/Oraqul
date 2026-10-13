'use client';

import { type Member, type Role, roleSchema } from '@oraqul/schema';
import { Button, Select } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api/http';
import { changeMemberRole, removeMember } from '@/lib/api/teams';
import { roleLabels } from '@/lib/roles';

const roleOptions = roleSchema.options;

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
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <p className="truncate text-sm font-semibold">
            {member.name}
            {isMe ? <span className="ml-2 font-normal text-muted">You</span> : null}
          </p>
          <p className="truncate text-[13px] text-muted">{member.email}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              id={`role-${member.userId}`}
              label={`Role for ${member.name}`}
              hideLabel
              value={member.role}
              disabled={pending}
              onChange={(event) => changeRole(roleSchema.parse(event.target.value))}
              className="min-h-10 md:min-h-0"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </Select>
            {confirming ? (
              <>
                <Button
                  size="small"
                  variant="primary"
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
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirming(true)}
                className="min-h-10 md:min-h-0"
              >
                {isMe ? 'Leave team' : 'Remove'}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">{roleLabels[member.role]}</p>
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
