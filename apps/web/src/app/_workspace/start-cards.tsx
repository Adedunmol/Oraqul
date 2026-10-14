'use client';

import type { Category, StartMode } from '@oraqul/schema';
import { buttonClassName, Icon } from '@oraqul/ui';
import Link from 'next/link';
import { useState } from 'react';
import { Modal } from '@/app/(app)/_components/modal';
import { startPath } from '@/lib/routes';
import { StartArt } from './start-art';

export const START_CHOICES: { mode: StartMode; title: string; gets: string; brings: string }[] = [
  {
    mode: 'start',
    title: 'Plan a launch',
    gets: 'Tell Oraqul what you are launching. You get a plan with the audience, places and dates, each backed by Qloo data.',
    brings: 'You bring: a title and a short description',
  },
  {
    mode: 'audit',
    title: 'Check a plan I have',
    gets: 'Paste or attach your plan. Oraqul tests each audience assumption and shows what holds and what breaks.',
    brings: 'You bring: your plan',
  },
  {
    mode: 'rescue',
    title: 'Rescue one that missed',
    gets: 'Say how it did. Oraqul finds where the audience was misread and builds a relaunch plan.',
    brings: 'You bring: your results',
  },
];

const cardBase =
  'start-card group flex flex-1 rounded-2xl bg-card text-left transition-colors duration-150 hover:bg-card-hover focus-visible:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none';

/**
 * The three ways to start, each opening the chat for that job. design-system §7.11. Pass
 * `category` when starting from a category's page, so the agent does not ask for it. `rows` lays
 * them out one under another, art beside the words, for the Start picker.
 */
export function StartCards({
  category,
  rows,
  onPick,
}: {
  category?: Category;
  rows?: boolean;
  onPick?: () => void;
}) {
  return (
    <ul className={rows ? 'flex flex-col gap-3' : 'grid grid-cols-1 gap-4 min-[900px]:grid-cols-3'}>
      {START_CHOICES.map((c) => (
        <li key={c.mode} className="flex">
          <Link
            href={startPath(c.mode, category)}
            onClick={onPick}
            className={`${cardBase} ${rows ? 'items-center gap-5 p-3 max-[599px]:flex-col max-[599px]:items-stretch' : 'flex-col gap-1 p-2'}`}
          >
            <span
              className={`block shrink-0 overflow-hidden rounded-xl bg-surface ${rows ? 'w-44 max-[599px]:w-full' : ''}`}
            >
              <StartArt
                mode={c.mode}
                className={`mx-auto block w-full ${rows ? 'max-h-28' : 'max-h-40 px-4 py-2'}`}
              />
            </span>
            <span className={`flex flex-1 flex-col gap-2 ${rows ? 'py-1 pr-2' : 'px-4 pt-4 pb-5'}`}>
              <b className="text-[16px] tracking-[-0.01em]">{c.title}</b>
              <span className="max-w-[46ch] text-[13.5px] leading-[1.55] text-muted">{c.gets}</span>
              <span className="mt-auto pt-2 text-[12.5px] font-medium">{c.brings}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * The one way to start from a list page: opens the three choices. A plus in a page head, or a
 * worded button where there is room, such as an empty list.
 */
export function StartButton({ category, worded }: { category?: Category; worded?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {worded ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={buttonClassName('primary')}
        >
          <Icon name="plus" className="size-4" />
          Start
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Start"
          aria-haspopup="dialog"
          data-tip="Start: plan, check or rescue"
          className="grid size-10 place-items-center rounded-[10px] bg-ink text-bg transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
        >
          <Icon name="plus" className="size-5" />
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="How do you want to start?" wide>
        <StartCards category={category} rows onPick={() => setOpen(false)} />
      </Modal>
    </>
  );
}
