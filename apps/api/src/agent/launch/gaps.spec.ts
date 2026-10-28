import { describeGap, gapsAsUntested } from './gaps.js';
import { blocked } from './text.js';

describe('describeGap', () => {
  it('lets a failed call be run again', () => {
    expect(
      describeGap({
        item: 'Venues',
        why: 'The Qloo call failed (timeout), so this was not asked.',
      }),
    ).toEqual({
      cantKind: 'failed',
      ask: 'Run it again to fill this in.',
    });
    expect(
      describeGap({ item: 'The rest', why: 'The Qloo call budget for this run ran out.' }).cantKind,
    ).toBe('failed');
  });

  it('asks for the detail when the person has to give it', () => {
    expect(
      describeGap({
        item: 'Rival dates',
        why: 'The plan gives no show date, so rivals cannot be compared.',
      }),
    ).toEqual({ cantKind: 'input', ask: 'Add that detail and I will test it.' });
  });

  it('offers a next step for anything else, and keeps a more specific one', () => {
    expect(
      describeGap({ item: 'Brands', why: 'Qloo returned nothing for this audience.' }),
    ).toEqual({
      cantKind: 'no-signal',
      ask: 'Tell me more about it, or name a close title, and I will look again.',
    });
    expect(
      describeGap({ item: 'Brands', why: 'Qloo returned nothing.', ask: 'Name a brand to check.' })
        .ask,
    ).toBe('Name a brand to check.');
  });

  it('leaves no gap without a way forward', () => {
    const out = gapsAsUntested([
      { item: 'A', why: 'x' },
      { item: 'B', why: 'The Qloo call failed (500).' },
    ]);
    expect(out.map((g) => g.id)).toEqual(['cant-q-1', 'cant-q-2']);
    expect(out.every((g) => g.ask && g.cantKind)).toBe(true);
  });
});

describe('blocked', () => {
  it('says what happened, what was kept and what to do next, and never ends on the problem', () => {
    expect(
      blocked({
        what: 'The data is not answering.',
        kept: 'Your brief is saved.',
        next: 'Try in a few minutes.',
      }),
    ).toBe('The data is not answering. Your brief is saved. Try in a few minutes.');
    expect(blocked({ what: 'Stopped.', next: 'Ask again.' })).toBe('Stopped. Ask again.');
  });
});
