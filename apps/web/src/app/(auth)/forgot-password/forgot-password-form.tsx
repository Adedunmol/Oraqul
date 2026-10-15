'use client';

import { Button, Input } from '@oraqul/ui';
import { type FormEvent, useState } from 'react';
import { requestReset } from '@/lib/api/auth';
import { AuthCard, FormError } from '../_components/auth-card';
import { useAuthForm } from '../_components/use-auth-form';

export function ForgotPasswordForm() {
  const form = useAuthForm('signin');
  const [email, setEmail] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    return form.run(
      () => requestReset(email),
      () => form.router.push(form.href('/reset-password', { email })),
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      lead="Enter your email and we send you a 6 digit code."
      links={[{ href: form.href('/sign-in'), label: 'Back to sign in' }]}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormError message={form.error} />
        <Button type="submit" variant="primary" disabled={form.pending}>
          {form.pending ? 'One moment…' : 'Send code'}
        </Button>
      </form>
    </AuthCard>
  );
}
