'use client';

import type { Category, StartMode } from '@oraqul/schema';
import { buttonClassName, Card, Tabs } from '@oraqul/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type Attachment, Composer } from '@/app/_workspace/chat/composer';
import { DemoNote } from '@/app/_workspace/demo-note';
import { StartArt } from '@/app/_workspace/start-art';
import { START_CHOICES } from '@/app/_workspace/start-cards';
import type { Viewer } from '@/lib/api/viewer';
import { createProject, setActor } from '@/lib/demo/actions';
import { getCategory } from '@/lib/demo/catalog';
import { overviewPath, projectsPath, startPath } from '@/lib/routes';

const OPENING: Record<StartMode, { say: string; placeholder: string }> = {
  start: {
    say: 'Tell me what you are launching: the title and a line about it. Add where and when if you know, and I will find the rest.',
    placeholder: 'Salt Road, a crime drama series opening in the UK and US in November',
  },
  audit: {
    say: 'Paste your plan or attach the file. I will test each audience assumption in it and show what holds and what breaks.',
    placeholder: 'Paste your plan here, or attach it below',
  },
  rescue: {
    say: 'Tell me what you launched and how it did. Attach results if you have them, such as sales, streams, wishlists or downloads.',
    placeholder: 'Late Lagos tour, Nov to Dec. Houston and Atlanta sold under half',
  },
};

/**
 * The draft chat for one way to start. It saves nothing: the project and its first thread are
 * created by the first message, so a choice nobody follows up leaves no empty project behind.
 */
export function StartScreen({
  mode,
  category,
  viewer,
}: {
  mode: StartMode;
  category?: Category;
  viewer: Viewer;
}) {
  const router = useRouter();
  const choice = START_CHOICES.find((c) => c.mode === mode) ?? START_CHOICES[0];
  const info = category ? getCategory(category) : undefined;
  const back = category ? projectsPath(category) : overviewPath;

  if (viewer.role === 'viewer') {
    return (
      <Card className="flex max-w-xl flex-col items-start gap-3 p-6">
        <h1 className="font-display text-2xl font-semibold">Editors and owners start launches.</h1>
        <p className="text-muted">Ask an owner on your team to make you an editor.</p>
        <Link href={back} className={buttonClassName('primary')}>
          Go back
        </Link>
      </Card>
    );
  }

  function send(text: string, files: Attachment[]) {
    setActor(viewer.name);
    const threadId = createProject({
      mode,
      category: category ?? null,
      text,
      files: files.map((f) => ({ name: f.name, text: f.text })),
    });
    router.replace(`/threads/${threadId}`);
  }

  return (
    <div className="view-enter flex flex-col gap-7" data-cat={category}>
      <DemoNote />
      <header className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {info ? info.name : (viewer.teamName ?? 'Start')}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-[clamp(26px,3vw,34px)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance">
            {choice?.title}
          </h1>
          <Tabs
            label="Way to start"
            selected={mode}
            onSelect={(next) => router.replace(startPath(next, category))}
            items={START_CHOICES.map((c) => ({
              key: c.mode,
              label: c.mode === 'start' ? 'Plan' : c.mode === 'audit' ? 'Check' : 'Rescue',
            }))}
          />
        </div>
      </header>
      <section
        aria-label="Chat"
        className="mx-auto flex w-full max-w-[760px] flex-col gap-5 rounded-2xl bg-card p-5 min-[700px]:p-7"
      >
        <div className="flex items-start gap-4">
          <span className="hidden w-28 shrink-0 overflow-hidden rounded-xl bg-surface2 min-[700px]:block">
            <StartArt mode={mode} className="block w-full" />
          </span>
          <p key={mode} className="item-new text-[15.5px] leading-[1.6]">
            {OPENING[mode].say}
          </p>
        </div>
        <Composer
          key={mode}
          placeholder={OPENING[mode].placeholder}
          allowFiles
          autoFocus
          onSend={send}
        />
        <p className="text-xs text-muted">
          {choice?.brings}. The project is saved when you send this.
        </p>
      </section>
    </div>
  );
}
