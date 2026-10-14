'use client';

import { Button, Input } from '@oraqul/ui';
import { type FormEvent, useState } from 'react';
import { requestCode } from '@/lib/api/auth';
import { AuthCard, FormError } from '../_components/auth-card';
import { useAuthForm } from '../_components/use-auth-form';

export function EmailCodeForm() {
  const form = useAuthForm('signin');
  const [email, setEmail] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    return form.run(
      () => requestCode(email),
      () => form.router.push(form.href('/verify', { email })),
    );
  }

  return (
    <AuthCard
      title="Sign in with an email code"
      lead="We email you a 6 digit code. Enter it on the next page."
      links={[
        { href: form.href('/sign-in'), label: 'Sign in with a password' },
        { href: form.href('/sign-up'), label: 'Create an account' },
      ]}
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
