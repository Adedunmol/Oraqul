import type { Finding, LaunchSection } from '@oraqul/schema';
import { dropUnsupported, supportLines } from './support.js';

const finding = (id: string, text: string): Finding => ({
  id,
  query: 'markets',
  text,
  entities: [],
  numbers: {},
  verdict: null,
  confidence: 'high',
  why: '',
  context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: [],
});

const section = (lines: LaunchSection['lines']): LaunchSection => ({
  key: 'markets',
  title: 'Markets',
  lines,
});
const line = (id: string, over: Partial<LaunchSection['lines'][number]> = {}) => ({
  id,
  kind: 'grounded' as const,
  text: 'Atlanta leads.',
  findingIds: ['f-a'],
  sourceIds: [],
  names: [],
  group: null,
  ...over,
});

describe('supportLines', () => {
  it('hands the check each grounded line with only the evidence it cites', () => {
    const lines = supportLines(
      [
        section([
          line('markets-1', { findingIds: ['f-a'] }),
          line('markets-2', { kind: 'playbook', findingIds: [] }),
          line('markets-3', { findingIds: ['f-b'], sourceIds: ['w1'] }),
        ]),
      ],
      [finding('f-a', 'Atlanta ranks first.'), finding('f-b', 'London ranks second.')],
      [{ id: 'w1', fact: 'FilmOne distributes in Lagos.', title: 'T', url: 'https://x.test' }],
    );
    expect(lines.map((l) => l.id)).toEqual(['markets-1', 'markets-3']);
    expect(lines[0]?.evidence).toEqual(['Atlanta ranks first.']);
    expect(lines[1]?.evidence).toEqual(['London ranks second.', 'FilmOne distributes in Lagos.']);
  });
});

describe('dropUnsupported', () => {
  const sections = [section([line('markets-1'), line('markets-2'), line('markets-3')])];

  it('takes out a line that is not or only partly supported, and says why', () => {
    const out = dropUnsupported(sections, [
      { id: 'markets-1', support: 'supported', reason: '' },
      { id: 'markets-2', support: 'not', reason: 'the findings rank Atlanta first, not Lagos' },
      { id: 'markets-3', support: 'partly', reason: 'no finding says why' },
    ]);
    expect(out.sections[0]?.lines.map((l) => l.id)).toEqual(['markets-1']);
    expect(out.dropped.map((d) => d.why)).toEqual([
      'It says more than the findings it cites show: the findings rank Atlanta first, not Lagos',
      'It says more than the findings it cites show: no finding says why',
    ]);
  });

  it('keeps a line the check did not answer for', () => {
    const out = dropUnsupported(sections, [{ id: 'markets-1', support: 'supported', reason: '' }]);
    expect(out.sections[0]?.lines).toHaveLength(3);
    expect(out.dropped).toEqual([]);
  });

  it('drops a section left with no lines', () => {
    const out = dropUnsupported(sections, [
      { id: 'markets-1', support: 'not', reason: 'x' },
      { id: 'markets-2', support: 'not', reason: 'x' },
      { id: 'markets-3', support: 'not', reason: 'x' },
    ]);
    expect(out.sections).toEqual([]);
  });
});
