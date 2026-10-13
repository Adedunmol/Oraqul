import { verdictSchema } from '@oraqul/schema';
import { VerdictPill } from '@oraqul/ui';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Oraqul</p>
      <h1 className="font-display text-[clamp(26px,3vw,34px)] font-medium leading-[1.1] tracking-[-0.015em] text-balance">
        Launch strategy you can check, line by line.
      </h1>
      <div className="flex flex-wrap gap-2">
        {verdictSchema.options.map((verdict) => (
          <VerdictPill key={verdict} verdict={verdict} />
        ))}
      </div>
    </main>
  );
}
