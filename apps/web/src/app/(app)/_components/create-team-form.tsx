'use client';

import { Button, Input } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { createTeam } from '@/lib/api/teams';
import { setCurrentTeam } from '@/lib/current-team';

export function CreateTeamForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const team = await createTeam(name);
      setCurrentTeam(team.id);
      router.push('/team');
      router.refresh();
      onDone?.();
    } catch {
      setError('The team could not be created. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-start gap-3">
      <div className="w-full">
        <Input
          id="team-name"
          label="Team name"
          required
          maxLength={80}
          autoComplete="off"
          placeholder="Your company"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={error}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={pending || name.trim() === ''}
        className="min-h-10 w-full md:min-h-0"
      >
        {pending ? 'Creating' : 'Create team'}
      </Button>
    </form>
  );
}
