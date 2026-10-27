'use client';

import { Button } from '@oraqul/ui';
import { useEffect, useState } from 'react';
import { resendVerification } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/http';

const COOLDOWN_SECONDS = 30;

/**
 * Asks for another confirmation email. It waits out a short cooldown after each send, so a double
 * click or an impatient person does not burn the API's limit of five codes in ten minutes.
 */
export function ResendVerification({ label = 'Resend email' }: { label?: string }) {
  const [wait, setWait] = useState(0);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend() {
    setPending(true);
    setNote('');
    try {
      await resendVerification();
      setNote('Sent. Check your inbox and spam folder.');
      setWait(COOLDOWN_SECONDS);
    } catch (error) {
      setNote(
        error instanceof ApiError && error.status === 429
          ? 'Too many emails sent. Try again in a few minutes.'
          : 'Could not send the email. Try again.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button size="small" onClick={resend} disabled={pending || wait > 0}>
        {wait > 0 ? `Resend in ${wait}s` : label}
      </Button>
      <span role="status" className="text-[13px] text-muted">
        {note}
      </span>
    </span>
  );
}
