'use client';

import { Button, Input } from '@oraqul/ui';
import { type FormEvent, useState } from 'react';
import { confirmReset } from '@/lib/api/auth';
import { AuthCard, FormError } from '../_components/auth-card';
import { PasswordInput } from '../_components/password-input';
import { useAuthForm } from '../_components/use-auth-form';

export function ResetPasswordForm() {
  const form = useAuthForm('reset');
  const [email, setEmail] = useState(form.emailParam);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const known = form.emailParam !== '';

  function submit(event: FormEvent) {
    event.preventDefault();
    return form.run(() => confirmReset({ email, code, password }), form.enter);
  }

  return (
    <AuthCard
      title="Choose a new password"
      lead={known ? `If ${email} has an account, we sent a 6 digit code to it.` : undefined}
      links={[{ href: form.href('/forgot-password'), label: 'Send a new code' }]}
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
        <PasswordInput
          id="password"
          label="New password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={form.error} />
        <Button type="submit" variant="primary" disabled={form.pending}>
          {form.pending ? 'One moment…' : 'Save password and sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}
