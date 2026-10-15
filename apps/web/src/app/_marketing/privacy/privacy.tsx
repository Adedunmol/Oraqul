import Link from 'next/link';
import type { ReactNode } from 'react';
import { wrap } from '../section';
import { SectionNav } from '../section-nav';

// TODO(contact): add the team's privacy email before Google sign in leaves testing mode.
const contact = 'the Oraqul team';

const sections: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <p>
        Oraqul is a hackathon project built and run by Wahab and Adedunmola. It is an AI agent for
        launch strategy in media and entertainment. This page says what we collect, why, and who
        else handles it. If anything here is unclear, ask {contact}.
      </p>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <ul>
        <li>
          <b>Your account.</b> Your name and email. If you set a password, we store only a salted
          hash of it, never the password. If you sign in with Google, we receive your name, email
          and whether Google has verified it.
        </li>
        <li>
          <b>What you give the agent.</b> Your messages, the files you attach, and the projects,
          chats and outputs Oraqul makes from them.
        </li>
        <li>
          <b>Results you upload.</b> We parse them into totals by place and age band, drop any
          personal columns, and delete the raw file.
        </li>
        <li>
          <b>Your team.</b> Which teams you belong to, your role in each, and invites you send or
          receive.
        </li>
      </ul>
    ),
  },
  {
    id: 'use',
    title: 'How we use it',
    body: (
      <p>
        Only to run Oraqul: to sign you in, to read what you ask and answer it, to send sign in
        codes and invites, and to show your work to your team. We do not sell your data, show ads,
        or use your projects to train models.
      </p>
    ),
  },
  {
    id: 'others',
    title: 'Who else handles it',
    body: (
      <ul>
        <li>
          <b>Qloo</b> receives only public entity names (titles, artists, brands), place names and
          age bands, to look up audience taste. Never your plan text, results or anything about a
          person.
        </li>
        <li>
          <b>Google (Gemini)</b>, the language model we use today, receives your messages and the
          text of small files you attach, so it can read the title, category and job and write the
          answer.
        </li>
        <li>
          <b>Brevo</b> sends our emails, so it receives your email address and the message: a sign
          in code or an invite.
        </li>
        <li>
          <b>Google</b>, only if you choose to sign in with Google.
        </li>
        <li>
          <b>Our hosts</b> run the website (Vercel) and the server and database (a private virtual
          server).
        </li>
      </ul>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and browser storage',
    body: (
      <ul>
        <li>
          <b>oraqul_session</b> keeps you signed in, for up to 30 days or until you sign out.
        </li>
        <li>
          <b>oraqul_team</b> remembers which of your teams is open.
        </li>
        <li>
          <b>oraqul_oauth</b> exists only while you sign in with Google, to protect that step.
        </li>
        <li>
          Your browser also stores your light or dark choice and whether the sidebar is collapsed.
          No advertising or tracking cookies.
        </li>
      </ul>
    ),
  },
  {
    id: 'keep',
    title: 'How long we keep it',
    body: (
      <p>
        Your account and your team’s work stay until you ask us to delete them. Sign in codes expire
        after 10 minutes, invites after 7 days, and sessions after 30 days.
      </p>
    ),
  },
  {
    id: 'choices',
    title: 'Your choices',
    body: (
      <p>
        You can ask to see, correct or delete your data at any time by contacting {contact}. A team
        owner can remove members and delete projects in the app.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: (
      <p>
        If this changes, we update this page and the date at the top. For how data moves through the
        product, see <Link href="/trust">Trust</Link>.
      </p>
    ),
  },
];

export function PrivacyBody() {
  return (
    <div
      className={`${wrap} grid gap-12 pb-[clamp(72px,10vw,144px)] min-[1000px]:grid-cols-[220px_minmax(0,1fr)]`}
    >
      <SectionNav sections={sections.map(({ id, title }) => ({ id, title }))} />
      <article className="flex max-w-[68ch] flex-col gap-12 rounded-2xl bg-card p-[clamp(22px,4vw,56px)]">
        {sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
            <h2
              id={`${s.id}-title`}
              className="pb-3 font-display text-[clamp(22px,2.4vw,28px)] font-semibold tracking-[-0.03em]"
            >
              {s.title}
            </h2>
            <div className="text-[16.5px] leading-[1.7] text-ink/85 [&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_b]:font-semibold [&_b]:text-ink [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-3 [&_ul]:pl-5">
              {s.body}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
