'use client';

import { Button, Input } from '@oraqul/ui';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { login } from '@/lib/api/auth';
import { AuthCard, FormError, GoogleButton } from '../_components/auth-card';
import { PasswordInput } from '../_components/password-input';
import { useAuthForm } from '../_components/use-auth-form';

export function SignInForm() {
  const form = useAuthForm('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    return form.run(() => login(email, password), form.enter);
  }

  return (
    <AuthCard
      title="Welcome back"
      lead="Sign in to pick up your projects."
      links={[
        { href: form.href('/email-code'), label: 'Email me a code' },
        { href: form.href('/sign-up'), label: 'Create an account' },
      ]}
    >
      <GoogleButton href={form.googleHref} />
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
        <PasswordInput
          id="password"
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={form.error} />
        <Button type="submit" variant="primary" disabled={form.pending}>
          {form.pending ? 'One moment…' : 'Sign in'}
        </Button>
      </form>
      <Link
        href={form.href('/forgot-password')}
        className="w-fit rounded-md text-[13px] text-muted underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        Forgot password?
      </Link>
    </AuthCard>
  );
}
