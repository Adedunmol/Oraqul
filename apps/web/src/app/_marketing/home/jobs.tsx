import { Icon, type IconName } from '@oraqul/ui';
import Link from 'next/link';
import { band, h2Class, leadClass, wrap } from '../section';

const jobs: {
  id: string;
  icon: IconName;
  title: string;
  gets: string;
  message: string;
}[] = [
  {
    id: 'plan',
    icon: 'sparkles',
    title: 'Make a plan',
    gets: 'A plan for each market, worked back from your release date.',
    message: 'Plan the release of Night Ferry in Lagos, London and Houston.',
  },
  {
    id: 'check',
    icon: 'check',
    title: 'Check my plan',
    gets: 'Every assumption marked as holding, weak or broken, with a stronger option where one breaks.',
    message: 'Check my plan: open in the UK, then Canada.',
  },
  {
    id: 'fix',
    icon: 'retry',
    title: 'Fix my plan',
    gets: 'Who actually came, which assumption missed, and a new plan built around them.',
    message: 'It missed. Here are our results by age band.',
  },
];

/** The three jobs, each with the message that starts it. The depth lives on the use cases page. */
export function Jobs() {
  return (
    <section aria-labelledby="jobs-title" className={band}>
      <div className={`${wrap} flex flex-col gap-14`}>
        <div className="grid gap-6 min-[900px]:grid-cols-[1.2fr_1fr] min-[900px]:items-end">
          <h2 id="jobs-title" className={h2Class}>
            Plan it. Check it. Fix it.
          </h2>
          <p className={`${leadClass} min-[900px]:justify-self-end`}>
            Say what you are working on, the way you would tell a colleague. Oraqul works out which
            job it is.
          </p>
        </div>
        <ul className="grid gap-4 min-[900px]:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-col gap-6 rounded-2xl bg-card p-7">
              <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon name={job.icon} className="size-5" />
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-[26px] leading-[1.1] font-semibold tracking-[-0.03em]">
                  {job.title}
                </h3>
                <p className="text-[16px] leading-[1.55] text-ink/75">{job.gets}</p>
              </div>
              <p className="mt-auto rounded-xl bg-inset px-4 py-3 text-[14.5px] leading-[1.5]">
                <span className="sr-only">You might type: </span>“{job.message}”
              </p>
            </li>
          ))}
        </ul>
        <Link
          href="/use-cases"
          className="w-fit text-[15px] font-medium text-accent hover:underline"
        >
          See each job in action
        </Link>
      </div>
    </section>
  );
}
