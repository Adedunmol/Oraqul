import { describe, expect, it } from 'vitest';
import { askedJob, decideFollowUp, type FollowUpReading } from './follow-up.js';

const reading: FollowUpReading = {
  job: 'answer',
  addPlaces: [],
  dropPlaces: [],
  addComps: [],
  dropComps: [],
  addCollabs: [],
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

  it('answers a question about a change and reruns only an instruction or a what-if', () => {
    const addPlaces = [{ value: 'Accra', quote: 'Accra' }];
    expect(job('Should we add Accra?', { addPlaces })).toBe('answer');
    expect(job('Add Accra to the plan', { addPlaces })).toBe('scenario');
    expect(job('What if we open in Accra?', { addPlaces })).toBe('scenario');
    // Whatever the model read, a question about a change is answered.
    expect(job('Should we add Accra?', { addPlaces, job: 'scenario' })).toBe('answer');
  });

  it('reads a change phrased with "test the plan" as a what-if', () => {
    const ages = [{ value: '55_and_older' as const, quote: 'older women' }];
    expect(job('test the plan with older women', { ages })).toBe('scenario');
  });
});

describe('askedJob', () => {
  it('reads an audit or a fix from plain words, and nothing from a build', () => {
    expect(askedJob('audit my launch plan')).toBe('audit');
    expect(askedJob('Fix this plan')).toBe('fix');
    expect(askedJob('A roguelike on Steam for 18 to 34')).toBeNull();
  });
});

describe('decideFollowUp: checking what has changed', () => {
  it.each([
    'Check what has changed since this plan was made',
    'check what’s changed',
    'Can you see what has changed in the research?',
    'Refresh the research',
    'Has anything changed?',
    'Has the release window changed?',
  ])('%s is a refresh', (text) => expect(job(text)).toBe('refresh'));

  it.each([
    'What changed in the cast?',
    'Fix this plan with what has changed',
    'Why did the launch flop in Abuja',
    'What if we open in Accra first?',
  ])('%s is not a refresh', (text) => expect(job(text)).not.toBe('refresh'));
});
