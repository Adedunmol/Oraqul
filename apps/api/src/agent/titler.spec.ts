import { MockLanguageModelV4 } from 'ai/test';
import {
  FallbackTitler,
  ModelTitler,
  ScriptedTitler,
  scriptedTitle,
  type Titler,
  UNNAMED_THREAD,
} from './titler.js';

function modelSaying(title: string) {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: JSON.stringify({ title }) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 40, noCache: 40, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 6, text: 6, reasoning: 0 },
      },
      warnings: [],
    },
  });
}

describe('scriptedTitle', () => {
  it('uses the first sentence in sentence case', () => {
    expect(
      scriptedTitle({ text: 'i have a song titled tomorrow. It is out in May.', files: [] }),
    ).toBe('I have a song titled tomorrow');
  });

  it('uses the first line and collapses spaces', () => {
    expect(scriptedTitle({ text: '  check   my plan\nfor the tour', files: [] })).toBe(
      'Check my plan',
    );
  });

  it('cuts a long message at a word', () => {
    const title = scriptedTitle({
      text: 'we are launching a feature documentary about the history of west african highlife music',
      files: [],
    });
    expect(title).toBe('We are launching a feature documentary about…');
    expect(title.length).toBeLessThanOrEqual(48);
  });

  it('names a chat from its file when there is no text', () => {
    expect(scriptedTitle({ text: '', files: ['launch-plan.pdf'] })).toBe('launch-plan.pdf');
  });

  it('leaves an empty message unnamed', () => {
    expect(scriptedTitle({ text: '  ', files: [] })).toBe(UNNAMED_THREAD);
  });
});

describe('ModelTitler', () => {
  it('trims quotes and the full stop off what the model wrote', async () => {
    const titler = new ModelTitler(modelSaying('"Tomorrow single release plan."'), 5_000);
    expect(await titler.title({ text: 'i have a song titled tomorrow', files: [] })).toBe(
      'Tomorrow single release plan',
    );
  });

  it('falls back to the scripted title when the model writes nothing', async () => {
    const titler = new ModelTitler(modelSaying('  '), 5_000);
    expect(await titler.title({ text: 'mentally mentallyyy', files: [] })).toBe(
      'Mentally mentallyyy',
    );
  });
});

describe('FallbackTitler', () => {
  it('names the chat the scripted way when the model fails', async () => {
    const failures: unknown[] = [];
    const broken: Titler = {
      title: async () => {
        throw new Error('quota');
      },
    };
    const titler = new FallbackTitler(broken, new ScriptedTitler(), (err) => failures.push(err));
    expect(await titler.title({ text: 'fix my book launch', files: [] })).toBe(
      'Fix my book launch',
    );
    expect(failures).toHaveLength(1);
  });
});
