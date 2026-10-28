import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type ActualEntry,
  type Output,
  outputDetailSchema,
  type PaceState,
  type ThreadEvent,
} from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { filmLaunch } from '../film/config.js';
import { askedRescue, decideFollowUp } from './follow-up.js';
import { rescuePick, runRescue } from './rescue.js';

const example = outputDetailSchema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../test/fixtures/demo-film-output.json', import.meta.url)),
      'utf8',
    ),
  ),
);
const plan: Output = example.output;
const inputs = { read: { places: ['London', 'Houston', 'Atlanta', 'Lagos'], ages: [] } } as never;

const entry = (city: string, value: number, onDate = '2099-03-01'): ActualEntry => ({
  id: crypto.randomUUID(),
  onDate,
  value,
  city,
  channel: '',
});

const behind = (entries: ActualEntry[]): PaceState => ({
  available: true,
  unavailableReason: null,
  signal: 'Advance screenings and presales',
  settings: null,
  entries,
  releaseDate: '2099-03-12',
  canRescue: true,
  result: {
    verdict: 'behind',
    reason: null,
    target: 1000,
    unit: 'tickets',
    actual: 300,
    expected: 400,
    gap: -100,
    gapPoints: -10,
    entries: 3,
    days: 2,
    asOf: '2099-03-01',
    daysToRelease: 11,
    note: '',
  },
});

const run = (pace: PaceState | null) => {
  const events: ThreadEvent[] = [];
  const out = runRescue(
    { emit: (e) => events.push(e), config: filmLaunch },
    plan,
    inputs,
    pace,
    plan.title,
  );
  return { out, events };
};

describe('rescuePick', () => {
  const p = plan.plan!;
  it('picks the territory the plan favours that holds the least of the figures', () => {
    // Only London is "okay" in the recorded plan, so it is the one effort is under applied in.
    const pick = rescuePick(p, [entry('London', 20), entry('Houston', 150), entry('Lagos', 130)]);
    expect(pick).toMatchObject({ why: 'figures', held: 20, total: 300 });
    expect(pick?.territory.name).toBe('London');
  });

  it('falls back to the first territory the plan favours when the figures name fewer than two', () => {
    expect(rescuePick(p, [])).toMatchObject({ why: 'lead', held: null });
    expect(rescuePick(p, [entry('Houston', 100)])?.territory.name).toBe('London');
  });

  it('matches cities regardless of case and spacing', () => {
    const pick = rescuePick(p, [entry(' london ', 5), entry('HOUSTON', 90)]);
    expect(pick?.territory.name).toBe('London');
  });
});

describe('runRescue', () => {
  it('saves a narrow plan of three checked sections, with the territory and channel named', async () => {
    const { out, events } = run(
      behind([entry('London', 20), entry('Houston', 150), entry('Lagos', 130)]),
    );
    const result = await out;
    expect(result.reason).toBe('finished');
    const rescue = result.output;
    expect(rescue?.kind).toBe('rescue');
    expect(rescue?.plan?.scope).toBe('narrow');
    expect(rescue?.plan?.dropped).toEqual([]);
    expect(rescue?.plan?.sections.map((s) => s.key)).toEqual(['bottom-line', 'markets', 'measure']);
    const bottom = rescue?.plan?.sections[0]?.lines.map((l) => l.text) ?? [];
    expect(bottom[0]).toBe('For the next seven days, put the effort into London on YouTube.');
    expect(bottom[1]).toContain('London at 20 of 300 so far');
    expect(rescue?.headline).toContain('100 tickets behind');
    expect(rescue?.headline).not.toMatch(/will|forecast|expect to/i);
    expect(events.some((e) => e.type === 'message')).toBe(true);
  });

  it('every grounded line cites a finding and every playbook line cites none', async () => {
    const result = await run(behind([entry('London', 20), entry('Houston', 150)])).out;
    for (const section of result.output?.plan?.sections ?? []) {
      for (const l of section.lines) {
        expect(l.kind === 'grounded' ? l.findingIds.length > 0 : l.findingIds.length === 0).toBe(
          true,
        );
      }
    }
  });

  it('says there is nothing to rescue unless the figures are behind, and saves nothing', async () => {
    for (const verdict of ['ahead', 'on-pace', 'too-early'] as const) {
      const pace = behind([]);
      pace.result = { ...pace.result!, verdict };
      const { out, events } = run(pace);
      expect((await out).output).toBeNull();
      expect(events[0]).toMatchObject({ type: 'message' });
    }
    const none = run(null);
    expect((await none.out).output).toBeNull();
    expect(JSON.stringify(none.events)).toContain('no figures');
  });
});

const reading = {
  job: 'answer',
  addPlaces: [],
  dropPlaces: [],
  addComps: [],
  dropComps: [],
  addCollabs: [],
  ages: [],
  gender: null,
  rivals: [],
  partner: null,
};

describe('asking for a rescue', () => {
  it.each(['Rescue this launch.', 'rescue the plan', 'Help us get back on pace'])(
    'reads %s',
    (text) => {
      expect(askedRescue(text)).toBe(true);
    },
  );
  it.each(['What is the rescue rate for strays?', 'Check what has changed', 'Why Houston first?'])(
    'leaves %s alone',
    (text) => {
      expect(decideFollowUp(reading as never, { text, recent: [], title: 'x' }).job).not.toBe(
        'rescue',
      );
    },
  );
  it('routes it before anything else', () => {
    expect(
      decideFollowUp(reading as never, { text: 'Rescue this launch.', recent: [], title: 'x' }),
    ).toEqual({ job: 'rescue' });
  });
});
