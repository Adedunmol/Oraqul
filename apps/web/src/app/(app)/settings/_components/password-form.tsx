'use client';

import { Button } from '@oraqul/ui';
import { type FormEvent, useState } from 'react';
import { PasswordInput } from '@/app/(auth)/_components/password-input';
import { changePassword } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/http';

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'Your current password is wrong, or the new one is too short.';
    if (error.status === 429) return 'Too many tries. Wait a few minutes, then try again.';
  }
  return 'Your password could not be changed. Try again.';
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mismatch = again !== '' && again !== next;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    setNotice('');
    try {
      await changePassword({
        currentPassword: hasPassword ? current : undefined,
        newPassword: next,
      });
      setCurrent('');
      setNext('');
      setAgain('');
      setNotice(hasPassword ? 'Password changed.' : 'Password added.');
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {hasPassword ? (
        <PasswordInput
          id="current-password"
          label="Current password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      ) : null}
      <PasswordInput
        id="new-password"
        label="New password"
        autoComplete="new-password"
        minLength={8}
        required
        value={next}
        onChange={(event) => setNext(event.target.value)}
      />
      <PasswordInput
        id="repeat-password"
        label="Repeat new password"
        autoComplete="new-password"
        minLength={8}
        required
        value={again}
        error={mismatch ? 'The passwords do not match.' : undefined}
        onChange={(event) => setAgain(event.target.value)}
      />
      <p className="text-[13px] text-muted">At least 8 characters.</p>
      {error ? (
        <p role="alert" className="text-[13px] text-breaks">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={pending || mismatch || next.length < 8 || (hasPassword && current === '')}
        >
          {pending ? 'Saving' : hasPassword ? 'Change password' : 'Add password'}
        </Button>
        <span role="status" className="text-[13px] text-muted">
          {notice}
        </span>
      </div>
    </form>
  );
}
