'use client';

import { Button, Input } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { updateProfile } from '@/lib/api/auth';

export function ProfileForm({ name: saved }: { name: string }) {
  const router = useRouter();
  const [name, setName] = useState(saved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const changed = name.trim() !== saved && name.trim() !== '';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    setNotice('');
    try {
      const { user } = await updateProfile(name);
      setName(user.name);
      setNotice('Saved.');
      // The sidebar and member lists read the name on the server.
      router.refresh();
    } catch {
      setError('Your name could not be saved. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        id="name"
        label="Your name"
        autoComplete="name"
        required
        maxLength={100}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setNotice('');
        }}
      />
      {error ? (
        <p role="alert" className="text-[13px] text-breaks">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending || !changed}>
          {pending ? 'Saving' : 'Save name'}
        </Button>
        <span role="status" className="text-[13px] text-muted">
          {notice}
        </span>
      </div>
    </form>
  );
}
