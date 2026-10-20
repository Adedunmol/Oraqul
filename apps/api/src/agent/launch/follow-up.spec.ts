import { describe, expect, it } from 'vitest';
import { decideFollowUp, type FollowUpReading } from './follow-up.js';

const reading: FollowUpReading = {
  job: 'answer',
  addPlaces: [],
  dropPlaces: [],
  addComps: [],
  dropComps: [],
  ages: [],
  gender: null,
  rivals: [],
  partner: null,
};

const job = (text: string, over: Partial<FollowUpReading> = {}) =>
  decideFollowUp({ ...reading, ...over }, { text, recent: [], title: 'Third Bridge' }).job;

describe('decideFollowUp: fix and audit are asked for the whole plan', () => {
  it.each([
    'Fix this plan',
    'fix my plan',
    'Improve it',
    'Write a better plan',
    'give me a fixed plan',
  ])('%s is a fix', (text) => expect(job(text)).toBe('fix'));

  it.each([
    'Check my plan: open in the UK, then Canada.',
    'audit my launch plan',
    'Review the plan',
    'why did the launch flop in Abuja',
  ])('%s is an audit', (text) => expect(job(text)).toBe('audit'));

  it.each([
    'fix the budget in this plan',
    'check how the plan plays in Lagos',
    'does the plan work for older women?',
    'make a new plan',
    'what does the audit say about Lagos',
  ])('%s is not a fix or an audit', (text) => expect(['fix', 'audit']).not.toContain(job(text)));

  it('reads a change phrased with "test the plan" as a what-if', () => {
    const ages = [{ value: '55_and_older' as const, quote: 'older women' }];
    expect(job('test the plan with older women', { ages })).toBe('scenario');
  });
});
