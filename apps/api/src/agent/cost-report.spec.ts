import { costRows, formatCostRows } from './cost-report.js';

const run = (
  agent: string,
  job: string | null,
  qlooCalls: number,
  tokens: number,
  wallMs: number,
) => ({
  agent,
  job,
  qlooCalls,
  tokens,
  wallMs,
});

describe('costRows', () => {
  const rows = costRows(
    [
      run('film', 'plan', 30, 10_000, 20_000),
      run('film', 'plan', 50, 30_000, 40_000),
      run('film', 'plan', 40, 20_000, 30_000),
      run('music', 'plan', 20, 5_000, 10_000),
      run('music', null, 0, 1_000, 1_000),
    ],
    2,
  );

  it('groups by category and kind of run', () => {
    expect(rows.map((r) => `${r.agent} ${r.job} ${r.runs}`)).toEqual([
      'film plan 3',
      'music plan 1',
      'music unrouted 1',
    ]);
  });

  it('gives the average, the 90th percentile and the most calls, in calls and seconds', () => {
    expect(rows[0]).toMatchObject({
      avgCalls: 40,
      p90Calls: 50,
      maxCalls: 50,
      avgTokens: 20_000,
      avgSeconds: 30,
    });
  });

  it('prices tokens only when given a price, and says it is an estimate by name', () => {
    expect(rows[0]?.avgDollars).toBe(0.04);
    expect(costRows([run('film', 'plan', 1, 1_000_000, 1000)], null)[0]?.avgDollars).toBeNull();
  });

  it('prints plain columns', () => {
    expect(formatCostRows(rows).split('\n')[0]).toContain('avg calls');
    expect(formatCostRows([])).toBe('No finished runs.');
  });
});
