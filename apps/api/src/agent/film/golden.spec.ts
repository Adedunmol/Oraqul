import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  cityNames,
  demoFetch,
  QlooClient,
  type SeenEntity,
  type ToolContext,
} from '@oraqul/engine';
import { type Receipt, verdictSchema } from '@oraqul/schema';
import { z } from 'zod';
import type { Handoff, Reply } from '../category-agents.js';
import { ungroundedLines } from '../grounding.js';
import { clearBaselineCache } from './baseline.js';
import { groundingReport } from './grounding-report.js';
import { type PlanRun, runFilmBuild } from './pipeline.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedFilmReader } from './read.js';
import { NoResearch } from './research.js';
import { TemplatePlanWriter } from './writer.js';

// Golden runs (docs/testing.md): the same input must give the same findings and verdicts every
// time. The wording is checked by rules, not compared, because a model writes it live.

const dir = fileURLToPath(new URL('../../../../../packages/eval/golden/film/', import.meta.url));

const expectSchema = z.object({
  headline: z.string(),
  assumptions: z.record(z.string(), verdictSchema),
  // The team's cities in the order the plan opens them.
  cities: z.array(z.string()),
  comps: z.array(z.object({ name: z.string(), source: z.enum(['you', 'added']) })),
  // Each finding's id and the first three names it returned.
  findings: z.record(z.string(), z.array(z.string())),
  // Lines per section by kind, as `grounded/playbook`.
  sections: z.record(z.string(), z.string()),
  moves: z.array(z.string().nullable()),
  // How well backed the plan is (`groundingReport`): a fall here is a plan that cites less.
  grounding: z.object({
    lines: z.number().int(),
    backed: z.number().int(),
    rankKept: z.number().int(),
    findingsUsed: z.number().int(),
    cities: z.record(z.string(), z.number().int()),
  }),
  dropped: z.number().int(),
  cannot: z.array(z.string()),
  // The launch rules a plan carries: the library version, the budget band, the one signal and its
  // target, each territory with its call, each call, and the partners per tier.
  launch: z.object({
    rules: z.string().nullable(),
    band: z.string().nullable(),
    signal: z.string().nullable(),
    territories: z.array(z.string()),
    calls: z.array(z.string()),
    partners: z.record(z.string(), z.number().int()),
  }),
});
type Expected = z.infer<typeof expectSchema>;

const caseSchema = z.object({
  // `demo` runs on the committed demo data; `live` names real titles and runs only on recordings.
  data: z.enum(['demo', 'live']).default('demo'),
  title: z.string(),
  brief: z.string(),
  // A plan for several cities with rivals makes more calls than the default budget allows.
  callBudget: z.number().int().default(60),
  replies: z.array(
    z.union([z.object({ optionIds: z.array(z.string()) }), z.object({ text: z.string() })]),
  ),
  // An expectation in an older shape reads as missing, so `UPDATE_GOLDEN=1` can replace it.
  expect: expectSchema.nullable().catch(null),
});
type GoldenCase = z.infer<typeof caseSchema>;

const recordingSchema = z.object({
  responses: z.record(z.string(), z.object({ status: z.number(), body: z.string() })),
  expect: expectSchema.nullable().catch(null),
});

async function run(golden: GoldenCase, fetchImpl: typeof fetch, source: Receipt['source']) {
  clearBaselineCache();
  const said = { text: golden.brief, files: [] };
  const handoff: Handoff = {
    category: 'film',
    mode: 'build',
    title: golden.title,
    inputs: said,
    message: said,
    recent: [],
    planId: null,
  };
  const deps = () => {
    const tools: ToolContext = {
      qloo: new QlooClient({
        baseUrl: source === 'demo' ? 'https://demo.invalid' : 'https://recorded.invalid',
        apiKey: 'golden',
        fetch: fetchImpl,
        callBudget: golden.callBudget,
        retryDelayMs: 0,
      }),
      source,
      entities: new Map<string, SeenEntity>(),
    };
    return {
      reader: new ScriptedFilmReader(),
      queries: new ScriptedQueryPlanner(),
      research: new NoResearch(),
      writer: new TemplatePlanWriter(),
      tools,
      emit: () => undefined,
    };
  };
  let result: PlanRun = await runFilmBuild(handoff, deps());
  for (const r of golden.replies) {
    if (result.state?.job !== 'build' || !result.state.pending) break;
    const reply: Reply =
      'optionIds' in r
        ? { kind: 'options', questionId: result.state.pending.id, optionIds: r.optionIds }
        : { kind: 'typed', text: r.text };
    result = await runFilmBuild(handoff, deps(), { state: result.state, reply });
  }
  return result;
}

function summarise(result: PlanRun): Expected {
  const output = result.output;
  if (!output?.plan) throw new Error(`The run stopped ${result.reason} with no plan`);
  const b = output.brief;
  const plan = output.plan;
  const count = (kind: string, lines: { kind: string }[]) =>
    lines.filter((l) => l.kind === kind).length;
  return {
    headline: output.headline,
    assumptions: Object.fromEntries(b.assumptions.map((a) => [a.id, a.verdict])),
    cities: b.places.map((p) => p.name),
    comps: plan.comps.map(({ name, source }) => ({ name, source })),
    findings: Object.fromEntries(
      plan.findings.map((f) => [f.id, f.entities.slice(0, 3).map((e) => e.name)]),
    ),
    sections: Object.fromEntries(
      plan.sections.map((s) => [
        s.key,
        `${count('grounded', s.lines)}/${count('playbook', s.lines)}`,
      ]),
    ),
    moves: output.moves.map((m) => m.lineId),
    grounding: (({ lines, backed, rankKept, findingsUsed, cities }) => ({
      lines,
      backed,
      rankKept,
      findingsUsed,
      cities,
    }))(
      groundingReport(
        plan,
        b.places.map((p) => p.name),
      ),
    ),
    dropped: plan.dropped.length,
    cannot: b.cannot.map((c) => c.item),
    launch: {
      rules: plan.rules?.version ?? null,
      band: plan.band ? `${plan.band.band} (${plan.band.source})` : null,
      signal: plan.signal
        ? `${plan.signal.primary}${plan.signal.target ? ` -> ${plan.signal.target.value} (${plan.signal.target.from})` : ''}`
        : null,
      territories: plan.territories.map(
        (t) =>
          `${t.name}:${t.role}:${plan.calls.find((c) => c.id === t.callId)?.direction ?? 'none'}`,
      ),
      calls: plan.calls.map((c) => `${c.subject}:${c.name}:${c.direction}:${c.confidence}`),
      partners: Object.fromEntries(
        (['A', 'B', 'C'] as const).map((t) => [
          t,
          plan.partners.filter((p) => p.tier === t).length,
        ]),
      ),
    },
  };
}

// The rules every plan's wording must keep (spec §6.2): the bottom line names only the
// team's cities, no line shows a receipt or call id, and every grounded line cites a finding.
function checkRules(result: PlanRun, teamCities: string[]) {
  const plan = result.output?.plan;
  if (!plan) throw new Error('Expected a plan');
  const ids = new Set(plan.findings.map((f) => f.id));
  const bottom = plan.sections.find((s) => s.key === 'bottom-line')?.lines ?? [];
  for (const line of bottom) {
    for (const city of cityNames()) {
      if (line.text.includes(city)) expect(teamCities).toContain(city);
    }
  }
  for (const line of plan.sections.flatMap((s) => s.lines)) {
    expect(line.text).not.toMatch(/receipt|[0-9a-f]{8}-[0-9a-f]{4}-/i);
    if (line.kind === 'grounded') {
      expect(line.findingIds.length).toBeGreaterThan(0);
      for (const id of line.findingIds) expect(ids.has(id)).toBe(true);
    }
  }
}

const all = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.live.json'));
const dataOf = (f: string) => caseSchema.parse(JSON.parse(readFileSync(`${dir}${f}`, 'utf8'))).data;
const cases = all.filter((f) => dataOf(f) === 'demo');
const liveCases = all.filter((f) => dataOf(f) === 'live');

describe('Film golden runs on demo data', { timeout: 20_000 }, () => {
  it('has the three Film build inputs', () => {
    expect(cases.length).toBeGreaterThanOrEqual(3);
  });

  it.each(cases)('%s', async (file) => {
    const golden = caseSchema.parse(JSON.parse(readFileSync(`${dir}${file}`, 'utf8')));
    const result = await run(golden, demoFetch, 'demo');
    expect(result.reason).toBe('finished');
    const output = result.output;
    if (!output) throw new Error('Expected a plan');
    // Grounding: every tested line has a receipt and names only what Qloo returned.
    expect(ungroundedLines(output.brief, result.receipts)).toEqual([]);
    checkRules(
      result,
      output.brief.places.map((p) => p.name),
    );
    const got = summarise(result);
    if (process.env.UPDATE_GOLDEN === '1') {
      writeFileSync(`${dir}${file}`, `${JSON.stringify({ ...golden, expect: got }, null, 2)}\n`);
      return;
    }
    expect(golden.expect).not.toBeNull();
    expect(got).toEqual(golden.expect);
  });
});

// The same inputs over live Qloo, recorded once with `RECORD_LIVE=1` and a key, then replayed
// offline. Recordings stay local until Qloo confirms they may be committed.
describe('Film golden runs on recorded live responses', { timeout: 20_000 }, () => {
  const key = process.env.QLOO_API_KEY;
  const base = process.env.QLOO_BASE_URL;
  const recordable = process.env.RECORD_LIVE === '1' && key && base;
  const live = liveCases.filter(
    (f) => recordable || existsSync(`${dir}${f.replace('.json', '.live.json')}`),
  );

  it.skipIf(live.length === 0).each(live.length ? live : ['none'])('%s', async (file) => {
    const golden = caseSchema.parse(JSON.parse(readFileSync(`${dir}${file}`, 'utf8')));
    const path = `${dir}${file.replace('.json', '.live.json')}`;
    const pathOf = (input: string | URL | Request) =>
      new URL(input instanceof Request ? input.url : input).pathname +
      new URL(input instanceof Request ? input.url : input).search;

    if (recordable) {
      const responses: Record<string, { status: number; body: string }> = {};
      const recording: typeof fetch = async (input, init) => {
        const url = new URL(pathOf(input), base);
        const res = await fetch(url, { ...init, headers: { ...init?.headers, 'X-Api-Key': key } });
        const body = await res.text();
        responses[pathOf(input)] = { status: res.status, body };
        return new Response(body, { status: res.status });
      };
      const result = await run(golden, recording, 'qloo');
      writeFileSync(path, `${JSON.stringify({ responses, expect: summarise(result) }, null, 2)}\n`);
      return;
    }

    const recorded = recordingSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
    const replay: typeof fetch = async (input) => {
      const hit = recorded.responses[pathOf(input)];
      return hit
        ? new Response(hit.body, { status: hit.status })
        : new Response(JSON.stringify({ message: 'not recorded' }), { status: 404 });
    };
    const result = await run(golden, replay, 'qloo');
    const output = result.output;
    if (!output) throw new Error(`The replay stopped ${result.reason} with no plan`);
    expect(ungroundedLines(output.brief, result.receipts)).toEqual([]);
    checkRules(
      result,
      output.brief.places.map((p) => p.name),
    );
    // The recorded responses stay; only what the code makes of them is re-recorded.
    if (process.env.UPDATE_GOLDEN === '1') {
      writeFileSync(
        path,
        `${JSON.stringify({ ...recorded, expect: summarise(result) }, null, 2)}\n`,
      );
      return;
    }
    // Every city the team chose is backed by Qloo as well as the others: a city that gets fewer
    // questions than another is a flaw in the query plan, not in Qloo's coverage.
    const floor = groundingReport(
      output.plan ?? ({ sections: [], findings: [], dropped: [], sources: [] } as never),
      output.brief.places.map((p) => p.name),
    );
    for (const [city, n] of Object.entries(floor.cities)) {
      expect(n, `${city} has too few lines backed by Qloo`).toBeGreaterThanOrEqual(3);
    }
    expect(recorded.expect).not.toBeNull();
    expect(summarise(result)).toEqual(recorded.expect);
  });
});

// The same inputs over live Qloo with nothing recorded or saved (decision D45). The wording is the
// template writer's, so what is judged is what code decides: that every grounded line cites a
// finding, that each of the team's cities is backed, and that the run stays inside the call budget.
// Run it with `LIVE_EVAL=1` and a key; it uses real calls, about 55 per case.
describe('Film live eval', { timeout: 300_000 }, () => {
  const key = process.env.QLOO_API_KEY;
  const base = process.env.QLOO_BASE_URL;
  const enabled = process.env.LIVE_EVAL === '1' && !!key && !!base;
  const budget = Number(process.env.QLOO_CALL_BUDGET ?? 80);

  it.skipIf(!enabled || liveCases.length === 0).each(liveCases.length ? liveCases : ['none'])(
    '%s',
    async (file) => {
      const golden = caseSchema.parse(JSON.parse(readFileSync(`${dir}${file}`, 'utf8')));
      const live: typeof fetch = async (input, init) => {
        const raw = new URL(input instanceof Request ? input.url : input);
        const url = new URL(raw.pathname + raw.search, base);
        return fetch(url, { ...init, headers: { ...init?.headers, 'X-Api-Key': key as string } });
      };
      const result = await run(golden, live, 'qloo');
      const output = result.output;
      if (!output) throw new Error(`The run stopped ${result.reason} with no plan`);
      expect(ungroundedLines(output.brief, result.receipts)).toEqual([]);
      checkRules(
        result,
        output.brief.places.map((p) => p.name),
      );
      const calls = new Set(result.receipts.map((r) => r.callId)).size;
      expect(calls, 'a run must stay inside the call budget').toBeLessThanOrEqual(budget);
      if (!output.plan) throw new Error('Expected a plan');
      const report = groundingReport(
        output.plan,
        output.brief.places.map((p) => p.name),
      );
      for (const [city, n] of Object.entries(report.cities)) {
        expect(n, `${city} has too few lines backed by Qloo`).toBeGreaterThanOrEqual(3);
      }
      console.log(
        `${file}: ${calls} calls, ${report.backed} of ${report.lines} lines backed, ${report.findingsUsed} findings used`,
      );
    },
  );
});
