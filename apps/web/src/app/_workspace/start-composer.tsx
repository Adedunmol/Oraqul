'use client';

import type { Category, StartMode } from '@oraqul/schema';
import { ChipButton } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createProject } from '@/lib/api/projects';
import { getCategory } from '@/lib/demo/catalog';
import { type Attachment, Composer } from './chat/composer';
import { toast } from './toast';

/**
 * The three jobs, as hints. Picking one changes the prompt, never what the person may type. The
 * words name the job (plan, check, fix), so they read the same in every category.
 */
export const START_CHOICES: {
  mode: StartMode;
  title: string;
  say: string;
  placeholder: string;
  brings: string;
}[] = [
  {
    mode: 'build',
    title: 'Make a plan',
    say: 'Tell me what it is: the title and a line about it. Add where and when if you know, and I will find the rest.',
    placeholder: 'Salt Road, a crime drama series opening in the UK and US in November',
    brings: 'You bring: a title and a short description',
  },
  {
    mode: 'audit',
    title: 'Check my plan',
    say: 'Paste your plan or attach the file. I will test each assumption in it and show what holds and what breaks. If the launch is already out, add how it did and I will look for why it fell short.',
    placeholder: 'Paste your plan here, or attach it below',
    brings: 'You bring: your plan',
  },
  {
    mode: 'fix',
    title: 'Fix my plan',
    say: 'Paste your plan or attach it. If the launch is out, add how it did, such as sales, streams, wishlists or downloads, and I will find what went wrong and fix the plan.',
    placeholder:
      'Paste your plan, and the results if it is out: Chicago and Austin sold under half',
    brings: 'You bring: your plan, and results if it is out',
  },
];

const OPENING =
  'Tell me about your film, series, album, book, podcast or game, and what you need. A title and a line is enough. Paste or attach a plan or results if you have them, and I will work out the rest.';

/**
 * The one way to start: the first message creates the project and its first thread. `category` and
 * the chips only give the agent a head start. spec §9.2
 */
export function StartComposer({
  teamId,
  category,
  mode: initialMode,
  autoFocus,
}: {
  /** The team the project is made in. */
  teamId: string;
  category?: Category;
  mode?: StartMode;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<StartMode | null>(initialMode ?? null);
  const [sending, setSending] = useState(false);
  const choice = START_CHOICES.find((c) => c.mode === mode);
  const info = category ? getCategory(category) : undefined;

  async function send(text: string, files: Attachment[]) {
    setSending(true);
    try {
      const { threadId } = await createProject(teamId, {
        text,
        mode: mode ?? undefined,
        category,
        attachments: files.map((f) => ({ name: f.name, text: f.text })),
      });
      router.push(`/threads/${threadId}`);
    } catch {
      setSending(false);
      toast('Oraqul could not save that. Try again in a moment.');
    }
  }

  return (
    <section
      aria-label="New project"
      data-cat={category}
      className="flex flex-col gap-4 rounded-2xl bg-card p-5 min-[700px]:p-6"
    >
      <p key={mode ?? 'any'} className="item-new max-w-[64ch] text-[15.5px] leading-[1.6]">
        {choice?.say ?? OPENING}
      </p>
      <Composer
        placeholder={choice?.placeholder ?? START_CHOICES[0]?.placeholder ?? ''}
        allowFiles
        autoFocus={autoFocus}
        disabled={sending}
        onSend={send}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-muted">Not sure how to put it? Start from:</span>
        {START_CHOICES.map((c) => (
          <ChipButton
            key={c.mode}
            selected={mode === c.mode}
            onClick={() => setMode((m) => (m === c.mode ? null : c.mode))}
          >
            {c.title}
          </ChipButton>
        ))}
      </div>
      <p className="text-xs text-muted">
        {choice ? `${choice.brings}. ` : ''}
        {info
          ? `Oraqul will use its ${info.name} checks.`
          : 'Oraqul works out the category and the job from what you write.'}{' '}
        The project is saved when you send.
      </p>
    </section>
  );
}
