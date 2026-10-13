'use client';

import { Button } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api/http';
import { acceptInvite } from '@/lib/api/invites';
import { setCurrentTeam } from '@/lib/current-team';

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'This invite is for a different email address.';
    if (error.status === 410) return 'This invite has expired or was already used.';
    if (error.status === 404) return 'This invite link is not valid.';
  }
  return 'Something went wrong. Try again.';
}

export function AcceptInvite({ token, teamName }: { token: string; teamName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function accept() {
    setPending(true);
    setError('');
    try {
      const { teamId } = await acceptInvite(token);
      setCurrentTeam(teamId);
      router.push('/team');
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="primary" onClick={accept} disabled={pending} className="min-h-10 md:min-h-0">
        {pending ? 'Joining' : `Join ${teamName}`}
      </Button>
      {error ? (
        <p role="alert" className="text-[13px] text-breaks">
          {error}
        </p>
      ) : null}
    </div>
  );
}
