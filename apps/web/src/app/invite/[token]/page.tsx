import { buttonClassName } from '@oraqul/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SignOutButton } from '@/app/_components/sign-out-button';
import { ApiError } from '@/lib/api/http';
import { getInvite } from '@/lib/api/invites-server';
import { getMe } from '@/lib/api/me';
import { roleLabels } from '@/lib/roles';
import { AcceptInvite } from './accept-invite';

const label = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';

export default async function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  const { token } = await params;
  const [{ user }, invite] = await Promise.all([
    getMe(`/invite/${token}`),
    getInvite(token).catch((error: unknown) => {
      // 400 is a link that is not shaped like ours, which is as unusable as one we never issued.
      if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
        notFound();
      }
      throw error;
    }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-16">
      <p className={label}>Invite</p>
      {invite.status === 'accepted' ? (
        <Panel title="This invite has already been used.">
          <p className="text-muted">
            If that was you, {invite.teamName} is on your team list. Otherwise ask{' '}
            {invite.invitedBy} for a new one.
          </p>
          <Link href="/team" className={buttonClassName('primary')}>
            Go to your team
          </Link>
        </Panel>
      ) : invite.status === 'expired' ? (
        <Panel title="This invite has expired.">
          <p className="text-muted">
            Invites last 7 days. Ask {invite.invitedBy} to send you a new one.
          </p>
        </Panel>
      ) : invite.emailMatches ? (
        <Panel title={`${invite.invitedBy} invited you to ${invite.teamName}.`}>
          <p className="text-muted">
            You would join as {roleLabels[invite.role].toLowerCase()}, signed in as {user.email}.
          </p>
          <AcceptInvite token={token} teamName={invite.teamName} />
        </Panel>
      ) : (
        <Panel title="This invite is for a different email address.">
          <p className="text-muted">
            It was sent to {invite.email}, and you are signed in as {user.email}. Sign out, then
            open the link again and sign in with {invite.email}.
          </p>
          <SignOutButton />
        </Panel>
      )}
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl bg-surface p-6">
      <h1 className="font-display text-[clamp(23px,2.3vw,28px)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance">
        {title}
      </h1>
      {children}
    </div>
  );
}
