import { wrap } from '../section';

const TOOLS: { name: string; does: string }[] = [
  { name: 'searchEntity', does: 'Finds a title, artist, brand or place in Qloo by name.' },
  {
    name: 'resolveBundle',
    does: 'Describes a launch as a bundle of comparable titles, one exact match each.',
  },
  {
    name: 'audienceBySegment',
    does: 'Age and gender skews for an audience, as an index per segment.',
  },
  { name: 'rankPlaces', does: 'Ranks cities by audience strength from one Qloo call.' },
  { name: 'lift', does: 'Scores candidates against a baseline from one ranking call.' },
  { name: 'scoreRivals', does: 'How much of an audience each rival release shares, in one call.' },
  {
    name: 'findTaste',
    does: 'What an audience likes in one kind of entity, shaped by place and age. Brands are found by category and city, then ranked as one list.',
  },
  {
    name: 'partnerFit',
    does: 'Brands, podcasts and series a film or title audience also likes, ranked by Qloo for one signal. A plan finds brands with findTaste by category and city instead.',
  },
  { name: 'topicMap', does: 'The topics an audience carries that rival shows’ audiences do not.' },
  { name: 'resolveTags', does: 'Turns a phrase into a Qloo tag, or null. Never a guess.' },
  { name: 'themeTags', does: 'The theme and archetype tags that best describe a set of titles.' },
  {
    name: 'filmProfiles, bookProfiles, gameProfiles',
    does: 'What Qloo lists for each title. Nothing is scored.',
  },
];

const HOSTED: { name: string; does: string }[] = [
  { name: 'oraqul_list_projects', does: 'The launch projects of the token’s team.' },
  {
    name: 'oraqul_build_plan',
    does: 'Start a launch plan. Returns a run_id at once; the run takes minutes.',
  },
  {
    name: 'oraqul_audit_plan, oraqul_fix_plan',
    does: 'Start an audit or a fix of a project’s plan or a plan you paste. Return a run_id at once.',
  },
  {
    name: 'oraqul_answer_question',
    does: 'Answer the question a run is waiting on, such as the budget band.',
  },
  {
    name: 'oraqul_get_run_status',
    does: 'Running, waiting (with the question and its options), finished, stopped or failed.',
  },
  {
    name: 'oraqul_get_plan',
    does: 'The finished plan as a summary: headline, moves, lines with the findings and pages they cite.',
  },
  {
    name: 'oraqul_get_watch_events',
    does: 'What the launch watch found, each event with its page and the day it was read, and where the team’s figures stand.',
  },
];

const code =
  'overflow-x-auto rounded-lg bg-inset px-3 py-2 font-mono text-[13px] leading-[1.6] text-ink';

export function DevelopersBody() {
  return (
    <div className={`${wrap} flex max-w-[860px] flex-col gap-12 py-[clamp(56px,8vw,112px)]`}>
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[clamp(26px,3vw,38px)] leading-[1.05] font-semibold tracking-[-0.035em]">
          The hosted server: plans, not raw data
        </h2>
        <p className="max-w-[62ch] text-[17px] leading-[1.65] text-ink/80">
          Oraqul runs an MCP server over streamable HTTP at{' '}
          <code className="font-mono text-[15px]">/mcp</code> on the API. It exposes the plan
          pipeline: an agent can build, audit and fix a launch plan for a team, follow the run, and
          read the finished plan and its watch events. It never exposes the raw Qloo tools, and what
          it returns is a plan and finding summary, the same as a share link allows: no receipts and
          no raw Qloo data.
        </p>
        <p className="max-w-[62ch] text-[17px] leading-[1.65] text-ink/80">
          Sign in to Oraqul, open Settings, then Connections, and make a personal token. It acts as
          you in one team, with your role, and every call is checked the way the app checks it. A
          run started this way counts against your monthly runs and the shared Qloo budget, and
          follows your team’s defaults and Oraqul’s refusals. It cannot send anything, confirm a
          send, change team defaults or make or revoke a token. Revoke a token and it stops working
          on its next call.
        </p>
        <pre className={code}>
          {
            'claude mcp add --transport http oraqul <your API>/mcp \\\n  --header "Authorization: Bearer <your token>"'
          }
        </pre>
        <ul className="overflow-hidden rounded-2xl bg-card">
          {HOSTED.map((t) => (
            <li
              key={t.name}
              className="grid gap-1 border-b border-line px-5 py-3.5 last:border-0 min-[700px]:grid-cols-[260px_minmax(0,1fr)] min-[700px]:gap-4"
            >
              <code className="font-mono text-[13.5px] font-medium">{t.name}</code>
              <span className="text-[15px] text-ink/80">{t.does}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[clamp(26px,3vw,38px)] leading-[1.05] font-semibold tracking-[-0.035em]">
          The local server: the Qloo tools only
        </h2>
        <p className="max-w-[62ch] text-[17px] leading-[1.65] text-ink/80">
          Separately, the repository has a local server over stdio with only the Qloo tools below,
          for developers working on the engine. It is not hosted and has no accounts.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[clamp(26px,3vw,38px)] leading-[1.05] font-semibold tracking-[-0.035em]">
          Run it
        </h2>
        <p className="max-w-[62ch] text-[17px] leading-[1.65] text-ink/80">
          The server speaks MCP over stdio. It runs on demo data unless you set{' '}
          <code className="font-mono text-[15px]">QLOO_MODE=live</code> and a Qloo key.
        </p>
        <pre className={code}>
          {'pnpm --filter "@oraqul/mcp..." build\nnode packages/mcp/dist/stdio.js'}
        </pre>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[clamp(26px,3vw,38px)] leading-[1.05] font-semibold tracking-[-0.035em]">
          What a call returns
        </h2>
        <p className="max-w-[62ch] text-[17px] leading-[1.65] text-ink/80">
          Every tool returns its data and one receipt for each Qloo call it made, as JSON text. A
          score, a verdict or a confidence in the data was computed by code from what Qloo returned.
          The tools send only public names, place names and age bands to Qloo.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[clamp(26px,3vw,38px)] leading-[1.05] font-semibold tracking-[-0.035em]">
          Tools
        </h2>
        <ul className="overflow-hidden rounded-2xl bg-card">
          {TOOLS.map((t) => (
            <li
              key={t.name}
              className="grid gap-1 border-b border-line px-5 py-3.5 last:border-0 min-[700px]:grid-cols-[260px_minmax(0,1fr)] min-[700px]:gap-4"
            >
              <code className="font-mono text-[13.5px] font-medium">{t.name}</code>
              <span className="text-[15px] text-ink/80">{t.does}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
