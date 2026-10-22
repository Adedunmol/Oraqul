import type { Finding, Receipt } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { LaunchBrief } from '../launch/brief.js';
import { routeFinding } from './findings.js';
import type { MusicRead } from './read.js';

type Row = LaunchBrief['teamOrder'][number];

const row = (place: string, lift: number): Row => ({
  place,
  status: 'ranked',
  rank: 1,
  affinity: lift / 10,
  lift,
  band: lift >= 1.2 ? 'strong' : 'weak',
  cells: 200,
  confidence: 'high',
  why: '4 of 4 anchors changed the result',
});

const receipt = (lineId: string): Receipt => ({
  callId: 'call-1',
  lineId,
  endpoint: '/v2/insights',
  input: {},
  returned: {},
  rule: 'Place lift.',
  confidence: 'high',
  source: 'demo',
  calledAt: '2026-01-01T00:00:00.000Z',
});

/** Runs the route test on cities with these lifts, played in the order given. */
function run(stops: [string, number][]) {
  const places = stops.map(([place]) => place);
  const brief = {
    brief: { assumptions: [], risks: [] },
    lineReceipts: stops.map(([place]) => receipt(`place-${place.toLowerCase()}`)),
    reasons: new Map<string, string>(),
    // The ranked cities, strongest first, as `rankPlaces` gives them.
    teamOrder: [...stops].sort((a, b) => b[1] - a[1]).map(([place, lift]) => row(place, lift)),
    worth: [],
    ages: {},
    genders: {},
  } as unknown as LaunchBrief;
  const found: Finding[] = [];
  routeFinding({
    brief,
    read: { places } as MusicRead,
    add: (finding, call) =>
      found.push({
        ...finding,
        numbers: finding.numbers ?? {},
        context: {} as never,
        callIds: [call.callId],
      }),
  });
  return { brief, found: found[0] };
}

describe('routeFinding (spec §5.4)', () => {
  it('holds when the tour already opens with the strongest cities', () => {
    const { brief, found } = run([
      ['Lagos', 2.0],
      ['London', 1.0],
      ['Houston', 0.5],
    ]);
    expect(found?.verdict).toBe('holds');
    expect(found?.text).toContain('already the strongest order');
    expect(brief.brief.assumptions.map((a) => a.id)).toEqual(['a-route']);
    expect(brief.brief.risks).toEqual([]);
  });

  it('is weak when another order starts noticeably stronger, and offers it beside the team’s', () => {
    const { brief, found } = run([
      ['Houston', 0.5],
      ['Lagos', 2.0],
      ['London', 1.0],
    ]);
    expect(found?.verdict).toBe('weak');
    // The strongest order is listed first, and the text states how far the team's order reaches.
    expect(found?.entities.map((e) => e.name)).toEqual(['Lagos', 'London', 'Houston']);
    expect(found?.text).toMatch(/reaches \d+% of the strength of the strongest order/);
    const assumption = brief.brief.assumptions[0];
    expect(assumption?.fix).toMatch(/^Keep your order, or try Lagos, then London, then Houston/);
    expect(assumption?.fix).not.toMatch(/\b(drop|remove|cut)\b/i);
    expect(brief.brief.risks.map((r) => r.id)).toEqual(['risk-a-route']);
  });

  it('breaks when the strongest cities come last', () => {
    const { found } = run([
      ['Houston', 0.1],
      ['London', 0.5],
      ['Accra', 1.5],
      ['Lagos', 3.0],
    ]);
    expect(found?.verdict).toBe('breaks');
  });

  it('leaves the route untested for a single city', () => {
    const { brief, found } = run([['Lagos', 1.5]]);
    expect(found).toBeUndefined();
    expect(brief.brief.assumptions).toEqual([]);
  });
});
