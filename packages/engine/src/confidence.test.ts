import { describe, expect, it } from 'vitest';
import { confidenceFor, countKnown } from './confidence';
import { isNearEdge } from './scoring';

const solid = { anchorsWithData: 4, knownAnchors: 3 };

describe('confidenceFor (spec §5.1)', () => {
  it('is high when every check passes, and says why', () => {
    const result = confidenceFor({ ...solid, leaveOneOut: { result: 'holds' }, cells: 400 });
    expect(result.level).toBe('high');
    expect(result.reason).toBe(
      'high: 4 anchors with data, 3 well known, and it holds when each is left out',
    );
  });

  it.each([
    [3, 'high'],
    [2, 'medium'],
    [1, 'lower'],
    [0, 'lower'],
  ] as const)('%s anchors with data caps it at %s', (anchorsWithData, level) => {
    expect(confidenceFor({ anchorsWithData, knownAnchors: 2 }).level).toBe(level);
  });

  it.each([
    [2, 'high'],
    [1, 'medium'],
    [0, 'lower'],
  ] as const)('%s known anchors caps it at %s', (knownAnchors, level) => {
    expect(confidenceFor({ anchorsWithData: 3, knownAnchors }).level).toBe(level);
  });

  it('is lower when the result rests on one anchor, and names it', () => {
    const result = confidenceFor({
      ...solid,
      leaveOneOut: { result: 'changes', restsOn: 'Lionheart' },
    });
    expect(result).toEqual({ level: 'lower', reason: 'lower: the result rests on Lionheart' });
  });

  it('is at most medium when leave one out was skipped for the budget', () => {
    expect(confidenceFor({ ...solid, leaveOneOut: { result: 'skipped' } }).level).toBe('medium');
  });

  it('is at most medium near a band edge', () => {
    expect(confidenceFor({ ...solid, nearEdge: true }).level).toBe('medium');
  });

  it.each([
    [100, 'high'],
    [99, 'medium'],
    [25, 'medium'],
    [24, 'lower'],
  ] as const)('a place with %s cells is %s', (cells, level) => {
    expect(confidenceFor({ ...solid, cells }).level).toBe(level);
  });

  it('is lower for a stand-in or a line that could not be tested', () => {
    expect(confidenceFor({ ...solid, standIn: "the genre's audience" })).toEqual({
      level: 'lower',
      reason: "lower: read from the genre's audience",
    });
    expect(confidenceFor({ ...solid, cannotTest: true }).level).toBe('lower');
  });

  it('takes the lowest ceiling', () => {
    const result = confidenceFor({ anchorsWithData: 2, knownAnchors: 0, nearEdge: true });
    expect(result).toEqual({ level: 'lower', reason: 'lower: no anchor Qloo knows well' });
  });
});

describe('countKnown', () => {
  it('counts popularity of 0.3 and above, and never counts a missing value', () => {
    expect(countKnown([0.3, 0.29, null, 0.9])).toBe(2);
  });
});

describe('isNearEdge', () => {
  it.each([
    ['lift', 1.25, true],
    ['lift', 1.26, false],
    ['lift', 1.45, true],
    ['fit', 72, true],
    ['fit', 71, false],
    ['overlap', 38, true],
  ] as const)('%s %s is near an edge: %s', (kind, value, near) => {
    expect(isNearEdge(kind, value)).toBe(near);
  });
});
