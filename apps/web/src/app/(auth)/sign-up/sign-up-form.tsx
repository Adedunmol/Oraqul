'use client';

import { Button, Input } from '@oraqul/ui';
import { type FormEvent, useState } from 'react';
import { signup } from '@/lib/api/auth';
import { AuthCard, FormError, GoogleButton } from '../_components/auth-card';
import { PasswordInput } from '../_components/password-input';
import { useAuthForm } from '../_components/use-auth-form';

export function SignUpForm() {
  const form = useAuthForm('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    return form.run(
      () => signup({ name, email, password }),
      () => form.router.push(form.href('/verify', { email })),
    );
  }

  return (
    <AuthCard
      title="Create your account"
      lead="Plan, check and fix launches, with a receipt on every claim."
      links={[{ href: form.href('/sign-in'), label: 'Already have an account? Sign in' }]}
    >
      <GoogleButton href={form.googleHref} />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          id="name"
          label="Your name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          id="password"
          label="Password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={form.error} />
        <Button type="submit" variant="primary" disabled={form.pending}>
          {form.pending ? 'One moment…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}
