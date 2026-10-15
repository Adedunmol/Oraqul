'use client';

import { Button, Input } from '@oraqul/ui';
import { type FormEvent, useState } from 'react';
import { verifyCode } from '@/lib/api/auth';
import { AuthCard, FormError } from '../_components/auth-card';
import { useAuthForm } from '../_components/use-auth-form';

export function VerifyForm() {
  const form = useAuthForm('verify');
  const [email, setEmail] = useState(form.emailParam);
  const [code, setCode] = useState('');
  const known = form.emailParam !== '';

  function submit(event: FormEvent) {
    event.preventDefault();
    return form.run(() => verifyCode(email, code), form.enter);
  }

  return (
    <AuthCard
      title="Enter your code"
      lead={
        known ? `We sent a 6 digit code to ${email}.` : 'Enter the 6 digit code we emailed you.'
      }
      links={[{ href: form.href('/email-code'), label: 'Send a new code' }]}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {known ? null : (
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <Input
          id="code"
          label="6 digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
        />
        <FormError message={form.error} />
        <Button type="submit" variant="primary" disabled={form.pending}>
          {form.pending ? 'One moment…' : 'Continue'}
        </Button>
      </form>
    </AuthCard>
  );
}
