import { describe, expect, it } from 'vitest';
import { answerSchema } from './agent';
import { codeRequestSchema, codeSchema, nextPathSchema, passwordSchema } from './auth';
import { claimSchema } from './claim';
import { threadEventSchema } from './events';

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
