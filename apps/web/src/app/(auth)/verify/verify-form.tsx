'use client';

import { codeSchema } from '@oraqul/schema';
import { Button, Input } from '@oraqul/ui';
import Link from 'next/link';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { verifyCode } from '@/lib/api/auth';
import { overviewPath } from '@/lib/routes';
import { ResendVerification } from '../../_components/resend-verification';
import { AuthCard, FormError } from '../_components/auth-card';
import { useAuthForm } from '../_components/use-auth-form';

/**
 * Confirms an address with the code or with the link in the email, which carries both in its
 * query. `signedInAs` is set for someone who signed up and is already inside the app.
 */
export function VerifyForm({ signedInAs }: { signedInAs?: string }) {
  const form = useAuthForm('verify');
  const email = signedInAs ?? form.emailParam;
  const [typedEmail, setTypedEmail] = useState('');
  const [code, setCode] = useState('');
  const fromLink = useRef(false);
  const linkCode = new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search,
  ).get('code');

  // The link in the email submits itself: one click, nothing to type. It runs once even when
  // React mounts the effect twice in development, because a code works only once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the link is read once on arrival
  useEffect(() => {
    if (fromLink.current || !email || !codeSchema.safeParse(linkCode).success) return;
    fromLink.current = true;
    void form.run(() => verifyCode(email, linkCode ?? ''), form.enter);
  }, []);

  const address = email || typedEmail;

  function submit(event: FormEvent) {
    event.preventDefault();
    return form.run(() => verifyCode(address, code), form.enter);
  }

  return (
    <AuthCard
      title="Confirm your email"
      lead={
        email
          ? `We sent a link and a 6 digit code to ${email}. Click the link, or enter the code here.`
          : 'Enter the 6 digit code we emailed you.'
      }
      links={
        signedInAs
          ? [{ href: overviewPath, label: 'Skip for now' }]
          : [{ href: form.href('/email-code'), label: 'Send a new code' }]
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {email ? null : (
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
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
          {form.pending ? 'One moment…' : 'Confirm email'}
        </Button>
      </form>
      {signedInAs ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-muted">
          Nothing came?
          <ResendVerification label="Send it again" />
        </p>
      ) : null}
      {signedInAs ? null : (
        <p className="text-[13px] text-muted">
          Already confirmed?{' '}
          <Link href={form.href('/sign-in')} className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
