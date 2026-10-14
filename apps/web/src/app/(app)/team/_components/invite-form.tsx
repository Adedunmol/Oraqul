'use client';

import { type Role, roleSchema } from '@oraqul/schema';
import { Button, Input } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Dropdown } from '@/app/_components/dropdown';
import { ApiError } from '@/lib/api/http';
import { inviteMember } from '@/lib/api/teams';
import { roleHelp, roleLabels } from '@/lib/roles';

const roleOptions = roleSchema.options.map((role) => ({
  value: role,
  label: roleLabels[role],
  description: roleHelp[role],
}));

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'Enter a valid email address.';
    if (error.status === 409) return 'That person is already on the team.';
    if (error.status === 429) return 'Too many invites sent. Try again later.';
    if (error.status === 502) return 'The email could not be sent. Try again.';
  }
  return 'Something went wrong. Try again.';
}

export function InviteForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    setNotice('');
    try {
      const sent = await inviteMember(teamId, { email, role });
      setNotice(`Invite sent to ${sent.email}.`);
      setEmail('');
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        id="invite-email"
        label="Email"
        type="email"
        autoComplete="off"
        required
        placeholder="name@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <Dropdown
          id="invite-role"
          label="Role"
          value={role}
          options={roleOptions}
          onChange={setRole}
        />
        <p className="text-[13px] text-muted">{roleHelp[role]}</p>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-breaks">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-[13px] text-muted">
          {notice}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        disabled={pending || email === ''}
        className="min-h-10 w-full md:min-h-0"
      >
        {pending ? 'Sending' : 'Send invite'}
      </Button>
    </form>
  );
}
