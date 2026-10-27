'use client';

import { Button, Input } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { renameTeam } from '@/lib/api/teams';
import { Modal } from '../../_components/modal';

/** The owner's way to rename the team. The name shows in the sidebar switcher and in invites. */
export function RenameTeam({ teamId, name: saved }: { teamId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(saved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await renameTeam(teamId, name.trim());
      setOpen(false);
      router.refresh();
    } catch {
      setError('The team could not be renamed. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        icon="edit"
        onClick={() => {
          setName(saved);
          setError('');
          setOpen(true);
        }}
      >
        Rename
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Rename team">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            id="rename-team"
            label="Team name"
            required
            maxLength={80}
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={error}
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={pending || name.trim() === '' || name.trim() === saved}
            >
              {pending ? 'Saving' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
