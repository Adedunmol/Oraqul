import { Icon } from '@oraqul/ui';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { roleHelp, roleLabels } from '@/lib/roles';
import { FlowDiagram } from '../flow-diagram';
import { Reveal } from '../reveal';
import { band, h2Class, wrap } from '../section';

export function Promises() {
  const items = [
    'Only public names, places and age bands go to Qloo.',
    'Uploaded results are kept as totals, never as people.',
    'Your plans are visible only to your team.',
    'Every number is computed by code you can check.',
  ];
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-4 rounded-2xl bg-card p-5 text-[17px] leading-[1.45]"
        >
          {item}
        </li>
      ))}
    </ol>
  );
}

export function Flow() {
  return (
    <section aria-labelledby="flow-title" className={`bg-bg ${band}`}>
      <div className={`${wrap} flex flex-col gap-12`}>
        <h2 id="flow-title" className={`${h2Class} max-w-[18ch]`}>
          What travels, and what stays.
        </h2>
        <FlowDiagram />
      </div>
    </section>
  );
}

const ledger: { what: string; goes: string; kept: string }[] = [
  {
    what: 'Titles, place names and age bands',
    goes: 'Qloo, to look up audience taste',
    kept: 'With the claim it supports, as its receipt',
  },
  {
    what: 'Your messages and plan text',
    goes: 'The configured language model provider, to read the job and write the answer. Never to Qloo',
    kept: 'In your team’s project and its chats',
  },
  {
    what: 'Results you upload',
    goes: 'Parsed into totals by place and age band',
    kept: 'Totals only. The numbers kept are totals by place and age band; the text of the file stays on your project, so leave personal columns out',
  },
  {
    what: 'Your name and email',
    goes: 'Our database, and our email service for sign in codes and invites',
    kept: 'With your account',
  },
  {
    what: 'Anything about a person',
    goes: 'Nowhere',
    kept: 'Not collected for planning',
  },
];

export function Ledger() {
  return (
    <section aria-labelledby="ledger-title" className={band}>
      <div className={`${wrap} flex flex-col gap-12`}>
        <h2 id="ledger-title" className={`${h2Class} max-w-[18ch]`}>
          Where each thing goes.
        </h2>
        <Reveal className="overflow-hidden rounded-2xl bg-card">
          <div className="grid grid-cols-3 gap-6 border-b border-line px-6 py-3.5 text-[13px] font-medium text-muted max-[799px]:hidden">
            <span>What</span>
            <span>Goes to</span>
            <span>Kept</span>
          </div>
          <ul>
            {ledger.map((row, i) => (
              <li
                key={row.what}
                className="mk-in grid gap-x-6 gap-y-1.5 border-b border-line px-6 py-5 last:border-0 min-[800px]:grid-cols-3"
                style={{ '--i': i } as CSSProperties}
              >
                <span className="text-[16px] font-semibold">{row.what}</span>
                <span className="text-[15px] text-ink/80">
                  <span className="font-medium text-muted min-[800px]:hidden">Goes to: </span>
                  {row.goes}
                </span>
                <span className="text-[15px] text-ink/80">
                  <span className="font-medium text-muted min-[800px]:hidden">Kept: </span>
                  {row.kept}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

const access: [string, boolean, boolean, boolean][] = [
  ['See the team and its members', true, true, true],
  ['Read projects, chats and outputs', true, true, true],
  ['Start and change projects, run the agent', true, true, false],
  ['See pending invites', true, false, false],
  ['Invite, change a role, remove a member', true, false, false],
];

export function Roles() {
  const roles = ['owner', 'editor', 'viewer'] as const;
  return (
    <section aria-labelledby="roles-title" className={`scheme-dark mk-glow bg-bg ${band}`}>
      <div className={`${wrap} grid gap-12 min-[1000px]:grid-cols-[0.8fr_1.2fr]`}>
        <div className="flex flex-col gap-6">
          <h2 id="roles-title" className={h2Class}>
            Who can see what.
          </h2>
          <p className="max-w-[44ch] text-[17px] leading-[1.6] text-ink/75">
            Work belongs to a team. Each person on it has one role, checked on every request before
            anything is read or changed.
          </p>
          <dl className="flex flex-col gap-4">
            {roles.map((r) => (
              <div key={r} className="flex flex-col gap-0.5">
                <dt className="font-medium">{roleLabels[r]}</dt>
                <dd className="text-[15px] text-ink/70">{roleHelp[r]}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="min-w-0 overflow-x-auto rounded-2xl bg-card">
          <table className="w-full text-left text-[14px] sm:text-[15px]">
            <caption className="sr-only">What each role can do</caption>
            <thead>
              <tr className="border-b border-line text-[13px] text-muted">
                <th scope="col" className="px-4 py-3.5 font-medium sm:px-5">
                  Action
                </th>
                {roles.map((r) => (
                  <th key={r} scope="col" className="px-1.5 py-3.5 text-center font-medium sm:px-3">
                    {roleLabels[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {access.map(([action, ...can]) => (
                <tr key={action} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-4 font-normal sm:px-5">
                    {action}
                  </th>
                  {can.map((yes, i) => (
                    <td key={roles[i]} className="px-1.5 py-4 text-center sm:px-3">
                      {yes ? (
                        <Icon name="check" className="mx-auto size-4 text-holds" />
                      ) : (
                        <span className="text-muted">No</span>
                      )}
                      <span className="sr-only">{yes ? 'Yes' : ''}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function SignIn() {
  const facts = [
    [
      'Sign in',
      'Email and password, Google, or a one time code by email. Codes expire after 10 minutes and work once.',
    ],
    ['Sessions', 'A sign in lasts up to 30 days on that browser. Signing out ends it.'],
    [
      'Share links',
      'Owners and editors can share one output as a read only link, and turn the link off at any time.',
    ],
  ];
  return (
    <section aria-labelledby="signin-title" className={`bg-bg ${band}`}>
      <div className={`${wrap} flex flex-col gap-12`}>
        <h2 id="signin-title" className={`${h2Class} max-w-[18ch]`}>
          Accounts and links.
        </h2>
        <div className="grid gap-3 min-[800px]:grid-cols-3">
          {facts.map(([title, text]) => (
            <div key={title} className="flex flex-col gap-3 rounded-2xl bg-canvas p-6">
              <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">{title}</h3>
              <p className="text-[15px] leading-[1.6] text-ink/75">{text}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-[15.5px] font-medium">
          <Link href="/privacy" className="text-accent hover:underline">
            Read the privacy policy
          </Link>
          <Link href="/method" className="text-accent hover:underline">
            How the numbers are computed
          </Link>
        </div>
      </div>
    </section>
  );
}
