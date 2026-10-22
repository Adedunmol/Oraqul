/** One finished run, as the cost report reads it. */
export interface RunCost {
  agent: string;
  job: string | null;
  qlooCalls: number;
  tokens: number;
  /** Milliseconds from start to finish. */
  wallMs: number;
}

export interface CostRow {
  agent: string;
  job: string;
  runs: number;
  avgCalls: number;
  p90Calls: number;
  maxCalls: number;
  avgTokens: number;
  avgSeconds: number;
  /** Null when no price per million tokens was given. Tokens are not split into input and output, so this is an estimate. */
  avgDollars: number | null;
}

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0;
}

const round = (n: number, places = 0) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/** Per category and kind of run: how many Qloo calls, tokens, seconds and (roughly) dollars one costs. */
export function costRows(runs: RunCost[], pricePerMillionTokens: number | null): CostRow[] {
  const groups = new Map<string, RunCost[]>();
  for (const run of runs) {
    const key = `${run.agent}\u0000${run.job ?? 'unrouted'}`;
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const [agent = '', job = ''] = key.split('\u0000');
      const calls = group.map((r) => r.qlooCalls).sort((a, b) => a - b);
      const avgTokens = average(group.map((r) => r.tokens));
      return {
        agent,
        job,
        runs: group.length,
        avgCalls: round(average(calls), 1),
        p90Calls: percentile(calls, 0.9),
        maxCalls: calls.at(-1) ?? 0,
        avgTokens: round(avgTokens),
        avgSeconds: round(average(group.map((r) => r.wallMs)) / 1000, 1),
        avgDollars:
          pricePerMillionTokens === null
            ? null
            : round((avgTokens / 1_000_000) * pricePerMillionTokens, 3),
      };
    })
    .sort((a, b) => a.agent.localeCompare(b.agent) || a.job.localeCompare(b.job));
}

/** The report as plain text columns, for a terminal. */
export function formatCostRows(rows: CostRow[]): string {
  if (rows.length === 0) return 'No finished runs.';
  const head = ['agent', 'job', 'runs', 'avg calls', 'p90', 'max', 'avg tokens', 'avg s', 'avg $'];
  const body = rows.map((r) => [
    r.agent,
    r.job,
    String(r.runs),
    String(r.avgCalls),
    String(r.p90Calls),
    String(r.maxCalls),
    String(r.avgTokens),
    String(r.avgSeconds),
    r.avgDollars === null ? '-' : String(r.avgDollars),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => (b[i] ?? '').length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ');
  return [line(head), ...body.map(line)].join('\n');
}
