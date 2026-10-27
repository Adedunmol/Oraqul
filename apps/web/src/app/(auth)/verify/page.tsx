import { meResponseSchema } from '@oraqul/schema';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serverGetIfSignedIn } from '@/lib/api/server';
import { overviewPath } from '@/lib/routes';
import { VerifyForm } from './verify-form';

export const metadata: Metadata = { title: 'Confirm your email · Oraqul' };

export default async function VerifyPage() {
  // Someone who signed up is already signed in: the page knows their address and has no need to ask.
  const me = await serverGetIfSignedIn('/auth/me', meResponseSchema);
  if (me?.user.emailVerified) redirect(overviewPath);
  return <VerifyForm signedInAs={me?.user.email} />;
}
