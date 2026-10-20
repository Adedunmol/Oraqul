'use client';

import type { OutputDetail } from '@oraqul/schema';
import { buttonClassName, Card, Icon, Logo } from '@oraqul/ui';
import Link from 'next/link';
import { OutputView } from '@/app/_workspace/output/output-view';
import { Toaster } from '@/app/_workspace/toast';
import { Tooltip } from '@/app/_workspace/tooltip';

/** The read only view of one output. Null is a link that is wrong or turned off. */
export function SharedScreen({ detail }: { detail: OutputDetail | null }) {
  return (
    <main
      data-cat={detail?.project.category}
      className="mx-auto my-2 flex w-[calc(100%-16px)] max-w-6xl flex-col gap-6 rounded-2xl border border-line bg-canvas px-[clamp(16px,3vw,40px)] py-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <p className="text-[13px] text-muted">Shared link · read only</p>
      </div>
      {detail ? (
        <OutputView
          detail={detail}
          initialTab={undefined}
          canEdit={false}
          teamName={null}
          shared
          publicExample
        />
      ) : (
        <Card className="flex max-w-xl flex-col items-start gap-3 p-6">
          <h1 className="font-display text-2xl font-semibold">This link does not work.</h1>
          <p className="text-muted">
            The owner may have turned it off, or the link is wrong. Ask them for a new one.
          </p>
          <Link href="/" className={buttonClassName('default', 'default', 'icon')}>
            <Icon name="home" className="size-4" />
            Back to Oraqul
          </Link>
        </Card>
      )}
      <Tooltip />
      <Toaster />
    </main>
  );
}
