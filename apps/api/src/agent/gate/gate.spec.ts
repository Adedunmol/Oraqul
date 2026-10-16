import type { GateReading } from '@oraqul/schema';
import { MockLanguageModelV4 } from 'ai/test';
import { FallbackGate, type Gate, gateDecide, ModelGate, ScriptedGate } from './gate.js';

const project = { category: 'music', mode: 'build', title: 'Midnight Sun' } as const;
const recent = [{ from: 'person', text: 'how can i get married' }] as const;

const opt = (label: string) => ({ label });

describe('gateDecide', () => {
  it('passes an on topic message', () => {
    expect(gateDecide({ fit: 'on_topic', question: null }, 'g1')).toEqual({ kind: 'pass' });
  });

  it('refuses an off topic message', () => {
    expect(gateDecide({ fit: 'off_topic', question: null }, 'g1')).toEqual({ kind: 'refuse' });
  });

  it('asks with the options it was given and remembers what each stands for', () => {
    const reading: GateReading = {
      fit: 'unclear',
      question: {
        prompt: 'Did you mean one of these?',
        options: [opt('Try Lagos'), opt('New project')],
      },
    };
    const decision = gateDecide(reading, 'g1');
    if (decision.kind !== 'ask') throw new Error('expected a question');
    expect(decision.pending.question.id).toBe('g1');
    expect(decision.pending.question.options.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(decision.pending.picks).toEqual({ o1: 'Try Lagos', o2: 'New project' });
  });

  it('passes an unclear message that has too few options to ask about', () => {
    const reading: GateReading = {
      fit: 'unclear',
      question: { prompt: 'Did you mean this?', options: [opt('Try Lagos')] },
    };
    expect(gateDecide(reading, 'g1')).toEqual({ kind: 'pass' });
    expect(gateDecide({ fit: 'unclear', question: null }, 'g1')).toEqual({ kind: 'pass' });
  });
});

describe('ModelGate', () => {
  it('parses the model output with the gate schema', async () => {
    const output: GateReading = { fit: 'off_topic', question: null };
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 30, noCache: 30, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 5, text: 5, reasoning: 0 },
        },
        warnings: [],
      },
    });
    const result = await new ModelGate(model, 5_000).check({ project, recent: [...recent] });
    expect(result.reading).toEqual(output);
    expect(result.tokens).toBe(35);
  });
});

describe('FallbackGate', () => {
  it('lets the message through when the model fails', async () => {
    const failures: unknown[] = [];
    const broken: Gate = {
      check: async () => {
        throw new Error('down');
      },
    };
    const gate = new FallbackGate(broken, new ScriptedGate(), (err) => failures.push(err));
    const result = await gate.check({ project, recent: [...recent] });
    expect(result.reading.fit).toBe('on_topic');
    expect(failures).toHaveLength(1);
  });
});
