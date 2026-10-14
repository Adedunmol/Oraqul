'use client';

import type { Output, Project } from '@oraqul/schema';
import { Button, buttonClassName, Chip } from '@oraqul/ui';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Modal } from '@/app/(app)/_components/modal';
import { setShareEnabled } from '@/lib/demo/actions';
import { verdictWord } from '../charts';
import { copyText } from '../toast';
import { lineLabel } from './receipt-drawer';

const H3 = ({ children }: { children: string }) => (
  <h3 className="font-display mb-1 text-[15px] font-semibold">{children}</h3>
);

/** A preview of the one page brief and its appendix. Downloads come with the export endpoint. */
export function ExportModal({
  open,
  onClose,
  output,
  project,
  teamName,
}: {
  open: boolean;
  onClose: () => void;
  output: Output;
  project: Project;
  teamName: string | null;
}) {
  const b = output.brief;
  const c = output.counts;
  const partner = output.brief.partners.find((p) => p.id === output.focusIds[0]);
  const top = (list: { name: string; fit: number }[]) =>
    list
      .slice()
      .sort((x, y) => y.fit - x.fit)
      .slice(0, 2)
      .map((x) => `${x.name} (${x.fit})`)
      .join(', ');
  return (
    <Modal open={open} onClose={onClose} title="Export preview" wide>
      <p className="text-muted">
        Page one is the brief to send around. The appendix has the detail and the evidence.
        Downloads are not built yet, so it is shown here instead.
      </p>
      <div className="flex flex-col gap-3.5 rounded-md bg-card p-[22px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            {output.kindLabel} · {output.label}
            {teamName ? ` · ${teamName}` : ''}
          </p>
          <h2 className="font-display mt-1 text-2xl font-semibold">{project.name}</h2>
          <p className="text-muted">
            {[project.kind, project.genre, project.places.join(', ')].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div>
          <H3>Bottom line</H3>
          <p className="text-base">{output.headline}</p>
        </div>
        <div>
          <H3>Do this</H3>
          <ol className="list-decimal pl-5">
            {output.moves.map((m) => (
              <li key={m.text}>{m.text}</li>
            ))}
          </ol>
        </div>
        <div>
          <H3>{`Confidence: ${output.confidence.level.charAt(0).toUpperCase()}${output.confidence.level.slice(1)}`}</H3>
          <p>{output.confidence.why}</p>
        </div>
        {output.kind === 'date' ? (
          <div>
            <H3>Rival dates</H3>
            <ul className="list-disc pl-5">
              {b.dates.map((d) => (
                <li key={d.id}>
                  {d.date} against {d.rival}: shared audience {d.overlap}. {d.advice}.
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {output.kind === 'partner' && partner ? (
          <div>
            <H3>Draft</H3>
            <div className="whitespace-pre-wrap rounded-lg bg-surface2 p-3 text-[13px]">
              {partner.draft}
            </div>
          </div>
        ) : null}
        {output.kind === 'rescue' && b.course ? (
          <div>
            <H3>Next steps</H3>
            <ul className="list-disc pl-5">
              {b.course.actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {output.kind !== 'date' && output.kind !== 'partner' && output.kind !== 'rescue' ? (
          <div>
            <H3>Plan at a glance</H3>
            <ul className="list-disc pl-5">
              {output.sections.map((s) => (
                <li key={s.key}>
                  {s.title}: {top(b[s.key])}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-muted">
          {output.evidence.length} Qloo calls back this brief. Full evidence is in the appendix.
          Demo data.
        </p>
      </div>
      <div className="flex flex-col gap-3.5 rounded-md bg-card p-[22px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Appendix
          </p>
          <h3 className="font-display mt-1 mb-1 text-[15px] font-semibold">
            Assumptions ({c.holds} hold, {c.weak} weak, {c.breaks} break, {c.cant} could not test)
          </h3>
          <ul className="list-disc pl-5">
            {b.assumptions.map((a) => (
              <li key={a.id}>
                <b>{verdictWord[a.verdict]}.</b> {a.text}. {a.why}
                {a.fix ? ` Fix: ${a.fix}` : ''}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <H3>Risks to watch</H3>
          <ul className="list-disc pl-5">
            {b.risks.map((k) => (
              <li key={k.id}>
                {k.text}. Watch for: {k.signal}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <H3>Could not test</H3>
          <ul className="list-disc pl-5">
            {b.cannot.map((k) => (
              <li key={k.id}>
                {k.item}. {k.reason}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <H3>Evidence</H3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['Line', 'Endpoint', 'Returned', 'Call'].map((h) => (
                    <th
                      key={h}
                      className="border-b border-line px-2 py-1.5 text-left font-semibold text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {output.evidence.map((row) => {
                  const r = output.receipts.find((x) => x.lineId === row.lineId);
                  return (
                    <tr key={row.lineId} className="align-top">
                      <td className="border-b border-line px-2 py-1.5">
                        {lineLabel(output, row.lineId)}
                      </td>
                      <td className="border-b border-line px-2 py-1.5 font-mono text-xs">
                        {r?.endpoint}
                      </td>
                      <td className="border-b border-line px-2 py-1.5">{row.returned}</td>
                      <td className="border-b border-line px-2 py-1.5 font-mono text-xs break-all">
                        {r?.callId}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const subscribeNoop = () => () => {};

/** Turns the read only link for one output on or off. */
export function ShareModal({
  open,
  onClose,
  share,
}: {
  open: boolean;
  onClose: () => void;
  share: { outputId: string; token: string; enabled: boolean };
}) {
  // The origin is only known in the browser; the server render shows the path alone.
  const origin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => '',
  );
  const url = `${origin}/s/${share.token}`;
  return (
    <Modal open={open} onClose={onClose} title="Share this output">
      <p className="text-muted">
        A read only link to one output. Anyone with it can read the output and open its evidence
        summary. They cannot edit, see other outputs or see the rest of your team&apos;s projects.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Chip>{share.enabled ? 'Link is on' : 'Link is off'}</Chip>
        <Button onClick={() => setShareEnabled(share.outputId, !share.enabled)}>
          {share.enabled ? 'Turn link off' : 'Turn link on'}
        </Button>
      </div>
      {share.enabled ? (
        <>
          <code className="block break-all rounded-lg bg-surface2 px-3 py-2.5 font-mono text-xs">
            {url}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => copyText(url, 'Link copied')}>
              Copy link
            </Button>
            <Link href={`/s/${share.token}`} className={buttonClassName()}>
              Open shared view
            </Link>
          </div>
          <p className="text-xs text-muted">
            Demo: the link works in this browser session. Real share links come with the share
            endpoint.
          </p>
        </>
      ) : (
        <p className="text-muted">The old link no longer works.</p>
      )}
    </Modal>
  );
}
