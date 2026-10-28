import type { FundCriterion } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { type EligibilityFacts, eligibilityOf } from './eligibility.js';

const facts: EligibilityFacts = {
  category: 'film',
  stage: 'development',
  nationality: 'Nigerian',
  territories: ['Lagos', 'London'],
};
const c = (
  field: FundCriterion['field'],
  text: string,
  value: string | null = text,
): FundCriterion => ({
  field,
  text,
  value,
});

describe('eligibilityOf', () => {
  it('is eligible only when every published criterion appears met and the page lists no more', () => {
    const out = eligibilityOf(
      [
        c('category', 'Feature film projects'),
        c('stage', 'Projects in development'),
        c('nationality', 'Nigerian producers'),
      ],
      facts,
    );
    expect(out).toMatchObject({ verdict: 'eligible', unknown: [], failed: [] });
    expect(out.met).toHaveLength(3);
  });

  it('can never be eligible with a criterion nothing can be compared with', () => {
    const out = eligibilityOf(
      [
        c('category', 'Feature film projects'),
        c('other', 'A track record of two festival selections'),
      ],
      facts,
    );
    expect(out.verdict).toBe('check');
    expect(out.unknown).toEqual(['A track record of two festival selections']);
  });

  it('is check when a fact the criterion needs is not known', () => {
    const out = eligibilityOf([c('stage', 'Projects in development')], { ...facts, stage: null });
    expect(out.verdict).toBe('check');
    const nat = eligibilityOf([c('nationality', 'Nigerian producers')], {
      ...facts,
      nationality: null,
    });
    expect(nat.verdict).toBe('check');
  });

  it('is check, never eligible, with no criteria at all or when the page lists other conditions', () => {
    expect(eligibilityOf([], facts).verdict).toBe('check');
    expect(eligibilityOf([c('category', 'Feature film projects')], facts, true).verdict).toBe(
      'check',
    );
  });

  it('is not eligible when a criterion clearly names another kind of work or another stage', () => {
    const music = eligibilityOf([c('category', 'Music recording projects')], facts);
    expect(music).toMatchObject({ verdict: 'not-eligible', failed: ['Music recording projects'] });
    const late = eligibilityOf(
      [c('category', 'Film'), c('stage', 'Projects in post production')],
      facts,
    );
    expect(late.verdict).toBe('not-eligible');
  });

  it('never rules a team out on nationality or place, because a region word contains it', () => {
    const out = eligibilityOf(
      [
        c('nationality', 'Producers from sub-Saharan Africa'),
        c('territory', 'Projects shot in Ghana'),
      ],
      facts,
    );
    expect(out.verdict).toBe('check');
    expect(out.failed).toEqual([]);
  });

  it('counts a territory the plan covers as met', () => {
    expect(eligibilityOf([c('territory', 'Distribution in Lagos')], facts).met).toEqual([
      'Distribution in Lagos',
    ]);
  });
});
