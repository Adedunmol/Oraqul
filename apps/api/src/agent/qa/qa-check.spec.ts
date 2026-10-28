import { qaCheck, summarise } from './qa-check.js';

type QaPlan = Parameters<typeof qaCheck>[0]['plan'];

const finding = (over: Partial<QaPlan['findings'][number]> = {}): QaPlan['findings'][number] => ({
  id: 'f-audience',
  query: 'audience',
  text: 'The comps’ audience is strongest among people aged 35 to 44.',
  entities: [{ entityId: null, name: 'Lagos State University', affinity: null, detail: null }],
  numbers: {},
  verdict: null,
  confidence: 'medium',
  why: '',
  context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: [],
  ...over,
});

const line = (text: string, over: Partial<QaPlan['sections'][number]['lines'][number]> = {}) => ({
  id: 'x-1',
  kind: 'grounded' as const,
  text,
  findingIds: ['f-audience'],
  sourceIds: [],
  names: [],
  group: null,
  ...over,
});

const plan = (over: Partial<QaPlan> = {}): QaPlan => ({
  sections: [
    { key: 'audience', title: 'Audience', lines: [line('Lead with Lagos State University.')] },
  ],
  findings: [finding()],
  sources: [],
  comps: [{ name: 'Americanah', source: 'you', match: null, choice: null }],
  partners: [],
  understanding: null,
  ...over,
});

const run = (p: QaPlan, cannot: { item: string; ask?: string }[] = []) =>
  qaCheck({ plan: p, cannot, briefText: 'A novel for Lagos.', today: '2026-10-28' });

describe('qaCheck', () => {
  it('finds nothing wrong in a plan that is clean', () => {
    expect(run(plan())).toEqual([]);
  });

  it('flags a name in a grounded line that no finding, page or brief holds', () => {
    const found = run(
      plan({
        sections: [
          {
            key: 'audience',
            title: 'Audience',
            lines: [line('Pitch it at Georgia State University and Lagos State University.')],
          },
        ],
      }),
    );
    expect(found.map((f) => f.rule)).toEqual(['stranger-name']);
    expect(found[0]?.text).toContain('Georgia State University');
  });

  it('flags a dead end and jargon in the plan body, but not in the gaps section', () => {
    const found = run(
      plan({
        sections: [
          {
            key: 'markets',
            title: 'Markets',
            lines: [line('Kochi could not be ranked.', { kind: 'playbook', findingIds: [] })],
          },
          {
            key: 'gaps',
            title: 'To sharpen',
            lines: [
              line('Qloo could not rank Kochi; tell me more.', {
                kind: 'playbook',
                findingIds: [],
              }),
            ],
          },
        ],
      }),
    );
    expect(found.map((f) => f.rule)).toEqual(['dead-end']);
  });

  it('flags a guessed launch', () => {
    const found = run(
      plan({
        understanding: {
          asked: 'x',
          goals: [],
          constraints: [],
          assumed: [
            {
              what: 'genre',
              value: 'drama',
              why: 'Nothing was said, so this is a typical Nollywood film.',
            },
          ],
          criteria: [],
          by: 'model',
        },
      }),
    );
    expect(found.map((f) => f.rule)).toEqual(['guessed-launch']);
  });

  it('flags an audience read as high when Oraqul chose the comps, and "your" wording', () => {
    const found = run(
      plan({
        comps: [{ name: 'Atomic Habits', source: 'added', why: null, match: null, choice: null }],
        findings: [
          finding({
            confidence: 'high',
            text: 'Your comps’ audience is strongest among people aged 35 to 44.',
          }),
        ],
        sections: [],
      }),
    );
    expect(found.map((f) => f.rule).sort()).toEqual([
      'chosen-comp-unexplained',
      'chosen-comps-high',
      'chosen-comps-yours',
    ]);
  });

  it('flags a market nothing confirms, and a brand with no market and no note', () => {
    const partner = (over: Partial<QaPlan['partners'][number]>) =>
      ({
        id: 'p',
        name: 'Cell C',
        tier: 'B',
        market: 'Ghana',
        from: 'qloo',
        fit: null,
        budgetFit: 'fits',
        price: 'unknown',
        findingIds: [],
        kind: 'brand',
        flags: [],
        moneyType: 'in_kind',
        ...over,
      }) as QaPlan['partners'][number];
    expect(run(plan({ partners: [partner({})] })).map((f) => f.rule)).toEqual([
      'unconfirmed-market',
    ]);
    expect(
      run(
        plan({
          partners: [
            partner({
              market: 'Ghana',
              check: { state: 'verified', note: null, country: 'Ghana', operates: [] },
            }),
          ],
        }),
      ),
    ).toEqual([]);
    expect(run(plan({ partners: [partner({ market: null })] })).map((f) => f.rule)).toEqual([
      'partner-no-note',
    ]);
  });

  it('flags an event that has passed and a gap with no next step', () => {
    const found = run(
      plan({
        sources: [
          {
            id: 'w1',
            fact: 'A festival runs on 14 August.',
            title: 'T',
            url: 'https://x.test',
            eventDate: '2026-08-14',
          },
        ],
      }),
      [{ item: 'Venues' }, { item: 'Brands', ask: 'Name one.' }],
    );
    expect(found.map((f) => f.rule).sort()).toEqual(['gap-no-ask', 'past-event']);
    expect(summarise(found)).toEqual({ S1: 1, S2: 1, S3: 0 });
  });
});
