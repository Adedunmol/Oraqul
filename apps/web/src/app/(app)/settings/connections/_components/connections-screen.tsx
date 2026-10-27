'use client';

import type { ApiToken } from '@oraqul/schema';
import { Button, Card, Input } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Dropdown } from '@/app/_components/dropdown';
import { toast } from '@/app/_workspace/toast';
import { createToken, revokeToken } from '@/lib/api/tokens';
import { ConfirmDialog } from '../../../_components/confirm-dialog';

const LIFETIMES = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: 'A year' },
] as const;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

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

function Snippet({ label, text, onCopy }: { label: string; text: string; onCopy: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="text-[12.5px] text-accent underline underline-offset-2"
        >
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-inset px-3 py-2.5 text-[12.5px] leading-[1.5]">
        {text}
      </pre>
    </div>
  );
}

/**
 * Personal tokens for the hosted MCP server. A token is shown once, here, when it is made: Oraqul
 * keeps only its hash. Through MCP an agent can build, audit and fix plans and read their results and
 * watch events. It cannot send anything, confirm a send, change team defaults or make a token.
 */
export function ConnectionsScreen({
  teamId,
  serverUrl,
  tokens,
}: {
  teamId: string;
  serverUrl: string;
  tokens: ApiToken[];
}) {
  const router = useRouter();
  const uid = useId();
  const [name, setName] = useState('');
  const [days, setDays] = useState<'30' | '90' | '365'>('90');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);

  async function make() {
    setBusy(true);
    try {
      const made = await createToken(teamId, {
        name: name.trim(),
        expiresInDays: Number(days) as 30 | 90 | 365,
      });
      setFresh(made.token);
      setName('');
      router.refresh();
    } catch {
      toast('Could not make the token. Confirm your email, then try again.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    try {
      await revokeToken(teamId, revoking.id);
      setRevoking(null);
      toast('Token revoked. It stops working now.');
      router.refresh();
    } catch {
      toast('Could not revoke it. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const copy = (text: string, done: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast(done),
      () => toast('Select the text and copy it'),
    );
  };

  const shown = fresh ?? '<your token>';
  const cli = `claude mcp add --transport http oraqul ${serverUrl} --header "Authorization: Bearer ${shown}"`;
  const json = JSON.stringify(
    {
      mcpServers: {
        oraqul: { type: 'http', url: serverUrl, headers: { Authorization: `Bearer ${shown}` } },
      },
    },
    null,
    2,
  );
  const live = tokens.filter((t) => !t.revokedAt && new Date(t.expiresAt) > new Date());

  return (
    <div className="flex flex-col gap-8">
      <Section
        id={`${uid}-make`}
        title="Make a token"
        note="It acts as you in this team, with your role. Remove it here and it stops working at once."
      >
        <div className="flex flex-col gap-3">
          <Input
            id={`${uid}-name`}
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="For example Claude on my laptop"
            maxLength={60}
          />
          <Dropdown<'30' | '90' | '365'>
            id={`${uid}-life`}
            label="Works for"
            value={days}
            onChange={setDays}
            options={[...LIFETIMES]}
          />
          <div>
            <Button variant="primary" disabled={busy || !name.trim()} onClick={() => void make()}>
              Make the token
            </Button>
          </div>
          {fresh ? (
            <div className="flex flex-col gap-2 rounded-xl bg-accent-soft px-4 py-3" role="status">
              <p className="text-[13.5px] font-medium">
                Copy it now. This is the only time it is shown.
              </p>
              <code className="break-all rounded-md bg-surface px-2.5 py-1.5 text-[12.5px]">
                {fresh}
              </code>
              <div>
                <Button size="small" onClick={() => copy(fresh, 'Token copied')}>
                  Copy the token
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Section>

      <Section
        id={`${uid}-list`}
        title="Your tokens"
        note={live.length ? `${live.length} working` : 'None yet.'}
      >
        {tokens.length === 0 ? (
          <p className="text-muted">No tokens yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {tokens.map((t) => {
              const ended = t.revokedAt || new Date(t.expiresAt) <= new Date();
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-1 basis-48 flex-col">
                    <span className="truncate text-sm font-medium">{t.name}</span>
                    <span className="text-[12.5px] text-muted">
                      {t.prefix}… ·{' '}
                      {t.revokedAt
                        ? `revoked ${day(t.revokedAt)}`
                        : ended
                          ? `expired ${day(t.expiresAt)}`
                          : `expires ${day(t.expiresAt)}`}
                      {' · '}
                      {t.lastUsedAt ? `last used ${day(t.lastUsedAt)}` : 'never used'}
                    </span>
                  </div>
                  {ended ? null : (
                    <Button size="small" variant="danger" onClick={() => setRevoking(t)}>
                      Revoke
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        id={`${uid}-setup`}
        title="Connect a client"
        note="Oraqul speaks MCP over streamable HTTP. Use your token as a bearer token."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium">Server URL</span>
              <button
                type="button"
                onClick={() => copy(serverUrl, 'URL copied')}
                className="text-[12.5px] text-accent underline underline-offset-2"
              >
                Copy
              </button>
            </div>
            <code className="break-all rounded-lg bg-inset px-3 py-2 text-[12.5px]">
              {serverUrl}
            </code>
          </div>
          <Snippet label="Claude Code" text={cli} onCopy={() => copy(cli, 'Command copied')} />
          <Snippet
            label="Any client that takes a JSON config with headers"
            text={json}
            onCopy={() => copy(json, 'Config copied')}
          />
          <p className="text-[13px] text-muted">
            ChatGPT and other apps that add a remote MCP server by URL need a place to set a custom
            header: use the server URL above and the header{' '}
            <code>Authorization: Bearer your token</code>. An app that only signs in with OAuth
            cannot connect yet.
          </p>
        </div>
      </Section>

      <Section
        id={`${uid}-can`}
        title="What Oraqul does through MCP"
        note="The same checks, caps and refusals as the app."
      >
        <div className="grid gap-4 min-[700px]:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[13.5px] font-semibold">It can</h3>
            <ul className="list-disc pl-5 text-[13.5px] text-muted">
              <li>List your team’s projects.</li>
              <li>Start a plan, an audit or a fix, and answer a question it asks.</li>
              <li>Report where a run is, and read the finished plan as a summary.</li>
              <li>Read a plan’s watch events and where the figures stand.</li>
            </ul>
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[13.5px] font-semibold">It cannot</h3>
            <ul className="list-disc pl-5 text-[13.5px] text-muted">
              <li>Send anything, or say that something was sent.</li>
              <li>Approve a pitch or move a sponsor or fund along.</li>
              <li>Change your team’s defaults, or make or revoke a token.</li>
              <li>Return raw Qloo data or receipts: only summaries, like a share link.</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          A run started this way counts against your runs this month and the shared Qloo budget, and
          follows your team’s defaults.
        </p>
      </Section>

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Revoke this token?"
        confirmLabel="Revoke the token"
        confirmIcon="trash"
        onConfirm={() => void revoke()}
        pending={busy}
      >
        <p>
          Anything using “{revoking?.name}” stops working on its next call. You can make another.
        </p>
      </ConfirmDialog>
    </div>
  );
}
