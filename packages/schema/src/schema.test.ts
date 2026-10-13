import { describe, expect, it } from 'vitest';
import { threadEventSchema } from './events';

describe('threadEventSchema', () => {
  it('parses a trace step', () => {
    const event = threadEventSchema.parse({
      type: 'trace.step',
      step: 1,
      of: 5,
      text: 'Searching for comparable titles',
    });
    expect(event.type).toBe('trace.step');
  });

  it('rejects an unknown event type', () => {
    expect(threadEventSchema.safeParse({ type: 'nope' }).success).toBe(false);
  });
});
