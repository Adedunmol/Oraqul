'use client';

import { Button } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/lib/api/auth';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await logout();
      router.push('/');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={signOut} disabled={pending}>
      Sign out
    </Button>
  );
}
