'use client';

import { Button, Icon } from '@oraqul/ui';
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
    <Button
      onClick={signOut}
      disabled={pending}
      data-rail-tip="Sign out"
      className="rail:size-9 rail:p-0"
    >
      <Icon name="signout" className="hidden rail:block" />
      <span className="rail:sr-only">Sign out</span>
    </Button>
  );
}
