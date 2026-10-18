import { describe, expect, it } from 'vitest';
import { answerSchema } from './agent';
import { codeRequestSchema, codeSchema, nextPathSchema, passwordSchema } from './auth';
import { claimSchema } from './claim';
import { threadEventSchema } from './events';
import { pinnedProjectsSchema } from './pin';
import { launchPlanSchema } from './plan';
import { questionCardSchema, threadItemSchema } from './thread';

const receiptId = '3f2b8c1e-6d6a-4c53-9b0e-0a1f4f1d2e11';

describe('threadEventSchema', () => {
  it('parses a trace step', () => {
    const event = threadEventSchema.parse({
      type: 'trace.step',
      agent: 'film',
      step: 1,
      of: 5,
      text: 'Searching for comparable titles',
    });
    expect(event.type).toBe('trace.step');
  });

  it('parses a stop', () => {
    expect(threadEventSchema.safeParse({ type: 'run.stopped', reason: 'waiting' }).success).toBe(
      true,
    );
  });

  it('rejects an unknown event type', () => {
    expect(threadEventSchema.safeParse({ type: 'nope' }).success).toBe(false);
  });

  it('rejects a message claim with no receipt', () => {
    const event = { type: 'message', body: 'x', claims: [{ text: 'y', receiptIds: [] }] };
    expect(threadEventSchema.safeParse(event).success).toBe(false);
  });
});

describe('answerSchema', () => {
  it('parses an option answer and a text answer', () => {
    expect(
      answerSchema.safeParse({ kind: 'options', questionId: 'q1', optionIds: ['yes'] }).success,
    ).toBe(true);
    expect(answerSchema.safeParse({ kind: 'text', questionId: 'q1', text: 'hi' }).success).toBe(
      true,
    );
  });

  it('rejects an option answer with nothing chosen', () => {
    expect(
      answerSchema.safeParse({ kind: 'options', questionId: 'q1', optionIds: [] }).success,
    ).toBe(false);
  });
});

describe('claimSchema', () => {
  it('needs at least one receipt', () => {
    expect(claimSchema.safeParse({ text: 'a', receiptIds: [receiptId] }).success).toBe(true);
    expect(claimSchema.safeParse({ text: 'a', receiptIds: [] }).success).toBe(false);
  });
});

describe('auth schemas', () => {
  it('lowercases and trims emails', () => {
    expect(codeRequestSchema.parse({ email: '  Ada@Example.COM ' }).email).toBe('ada@example.com');
  });

  it('requires passwords of at least 8 characters', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
  });

  it('accepts only 6 digit codes', () => {
    expect(codeSchema.safeParse('123456').success).toBe(true);
    expect(codeSchema.safeParse('12345').success).toBe(false);
    expect(codeSchema.safeParse('12345a').success).toBe(false);
  });

  it('keeps next paths on the same site', () => {
    expect(nextPathSchema.safeParse('/projects').success).toBe(true);
    expect(nextPathSchema.safeParse('//evil.com').success).toBe(false);
    expect(nextPathSchema.safeParse('https://evil.com').success).toBe(false);
    expect(nextPathSchema.safeParse('/\\evil.com').success).toBe(false);
  });
});

describe('threadItemSchema', () => {
  it('keeps the fields of each question card type', () => {
    const card = questionCardSchema.parse({
      id: 'q1',
      card: 'split',
      prompt: 'Audience by age?',
      split: { title: 'Audience by age', groups: ['18 to 24', '25 and over'], values: [62, 38] },
    });
    expect(card.card === 'split' && card.split.values).toEqual([62, 38]);
  });

  it('rejects a card whose fields belong to another type', () => {
    const wrong = { id: 'q1', card: 'single', prompt: 'Pick one', hint: 'Type it' };
    expect(questionCardSchema.safeParse(wrong).success).toBe(false);
  });

  it('rejects an output item that does not point at an output id', () => {
    expect(threadItemSchema.safeParse({ id: 'i1', role: 'output', outputId: 'o1' }).success).toBe(
      false,
    );
  });
});

describe('pinnedProjectsSchema', () => {
  it('accepts project ids', () => {
    expect(pinnedProjectsSchema.parse(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('rejects an empty id or a value that is not a list', () => {
    expect(pinnedProjectsSchema.safeParse(['']).success).toBe(false);
    expect(pinnedProjectsSchema.safeParse({ kind: 'project', id: 'a' }).success).toBe(false);
  });
});

describe('launch plan and findings', () => {
  const finding = {
    id: 'f-music-lagos',
    query: 'music',
    text: 'In Lagos, the Afrobeats artists that rank highest with your comps’ audience are Tems.',
    entities: [{ entityId: null, name: 'Tems', affinity: 0.9, detail: null }],
    numbers: {},
    verdict: null,
    confidence: 'high',
    why: 'high: 3 anchors with data',
    context: {
      city: 'Lagos',
      ages: [],
      tags: ['Afrobeats'],
      country: null,
      yearFrom: null,
      audience: null,
    },
    callIds: ['00000000-0000-4000-8000-000000000001'],
  };

  it('streams a finding as a thread event and stores it on a trace item', () => {
    expect(threadEventSchema.parse({ type: 'finding', finding }).type).toBe('finding');
    const trace = threadItemSchema.parse({ id: 't', role: 'trace', steps: ['Reading'], done: 1 });
    expect(trace.role === 'trace' && trace.findings).toEqual([]);
  });

  it('keeps grounded and playbook lines apart and rejects an unknown section', () => {
    const plan = {
      scope: 'full',
      sections: [
        {
          key: 'partnerships',
          title: 'Partnerships',
          lines: [
            {
              id: 'p-1',
              kind: 'grounded',
              text: 'Approach Tems.',
              findingIds: ['f-music-lagos'],
              names: ['Tems'],
              group: null,
            },
            {
              id: 'p-2',
              kind: 'playbook',
              text: 'Watermark screeners.',
              findingIds: [],
              names: [],
              group: null,
            },
          ],
        },
      ],
      comps: [{ name: 'King of Boys', source: 'you', match: '2018 · Nigeria', choice: null }],
      findings: [finding],
      dropped: [],
      writer: 'template',
    };
    expect(launchPlanSchema.parse(plan).sections[0]?.lines).toHaveLength(2);
    expect(
      launchPlanSchema.safeParse({ ...plan, sections: [{ ...plan.sections[0], key: 'trailers' }] })
        .success,
    ).toBe(false);
  });
});
