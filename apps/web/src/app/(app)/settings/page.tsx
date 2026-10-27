import { Card, Chip, PageHead } from '@oraqul/ui';
import type { Metadata } from 'next';
import { SignOutButton } from '@/app/_components/sign-out-button';
import { getMe } from '@/lib/api/me';
import { PasswordForm } from './_components/password-form';
import { ProfileForm } from './_components/profile-form';

export const metadata: Metadata = { title: 'Settings · Oraqul' };

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="font-display text-[16px] font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        <p className="text-[13px] text-muted">{note}</p>
      </div>
      <Card className="p-5">{children}</Card>
    </section>
  );
}

export default async function SettingsPage() {
  const { user } = await getMe('/settings');
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHead
        className="sticky-head"
        title="Settings"
        description="Your name, your password and how you sign in."
      />

      <Section
        id="profile-title"
        title="Profile"
        note="Your name shows to your team in members lists and invites."
      >
        <div className="flex flex-col gap-5">
          <ProfileForm name={user.name} />
          <div className="flex flex-col gap-1.5 border-t border-line pt-5">
            <span className="text-[13px] font-medium">Email</span>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              {user.email}
              <Chip>{user.emailVerified ? 'Confirmed' : 'Not confirmed yet'}</Chip>
            </p>
            <p className="text-[13px] text-muted">
              This is how you sign in and where codes are sent. It cannot be changed here.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="password-title"
        title="Password"
        note={
          user.hasPassword
            ? 'Changing it signs you out of your other devices.'
            : 'You sign in with Google or an emailed code. Add a password to sign in with one too.'
        }
      >
        <PasswordForm hasPassword={user.hasPassword} />
      </Section>

      <Section id="account-title" title="Sign out" note="End this session on this device.">
        <SignOutButton />
      </Section>
    </div>
  );
}
