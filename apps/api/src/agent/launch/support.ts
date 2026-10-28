import type { DroppedLine, Finding, LaunchSection, PlanSource } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';

/** Lines checked in one call. More than this and a model starts to skim. */
const BATCH = 20;

export const supportResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      support: z.enum(['supported', 'partly', 'not']),
      /** What the line says that the evidence does not, in plain words. Empty when supported. */
      reason: z.string(),
    }),
  ),
});
export type SupportResult = z.infer<typeof supportResultSchema>['results'][number];

export interface SupportLine {
  id: string;
  text: string;
  /** The sentences of the findings the line cites, and the facts of the pages it cites. */
  evidence: string[];
}

export interface SupportInput {
  category: string;
  lines: SupportLine[];
}

export const SUPPORT_SYSTEM = `You check whether each line of a launch plan is supported by the evidence it cites. You get lines, each with the evidence it cites: sentences from measured audience data, and facts from web pages. You do not judge style, advice or whether a line is a good idea.

For each line decide:
- supported: every claim the line makes about an audience, a taste, a place, an order or a direction follows from its evidence. Launch advice that is not a claim about the audience ("lead with short video", "send the screener two weeks before") needs no evidence.
- partly: some claim goes beyond the evidence, or fixes an order, a segment or a reason the evidence does not give.
- not: the line says something the evidence does not say, or contradicts it.

Check these, one by one:
- Names: a name the line recommends because of the audience must be in its evidence.
- Order: "first", "then", "strongest", "weakest" must match the order in the evidence.
- Who it is about: a claim about men, women or an age group must be about that group in the evidence, not the whole audience. A claim about one city must be about that city.
- Direction: a city or choice the evidence calls weak cannot be called strong.
- Subject: a list of distributors does not show what leaks, and a ranking of cities does not show what to buy.
- Reasons: "because" must give a reason the evidence states.

Reason: one short plain sentence that names what the evidence does not give, so the writer can narrow the line. Leave it empty for a supported line. Never write a number or a verdict about an audience.`;

/** The grounded lines of a draft, each with the evidence it cites. */
export function supportLines(
  sections: LaunchSection[],
  findings: Finding[],
  sources: PlanSource[],
): SupportLine[] {
  return sections.flatMap((s) =>
    s.lines
      .filter((l) => l.kind === 'grounded' && (l.findingIds.length || l.sourceIds.length))
      .map((l) => ({
        id: l.id,
        text: l.text,
        evidence: [
          ...l.findingIds.flatMap((id) => findings.find((f) => f.id === id)?.text ?? []),
          ...l.sourceIds.flatMap((id) => sources.find((x) => x.id === id)?.fact ?? []),
        ],
      })),
  );
}

export async function askSupport(
  model: LanguageModel,
  timeoutMs: number,
  input: SupportInput,
): Promise<{ results: SupportResult[]; tokens: number }> {
  const batches: SupportLine[][] = [];
  for (let i = 0; i < input.lines.length; i += BATCH) batches.push(input.lines.slice(i, i + BATCH));
  const out = await Promise.all(
    batches.map(async (lines) => {
      const { output, usage } = await generateText({
        model,
        system: SUPPORT_SYSTEM,
        prompt: [
          `Category: ${input.category}`,
          '',
          ...lines.flatMap((l) => [
            `Line ${l.id}: ${l.text}`,
            ...l.evidence.map((e) => `  evidence: ${e}`),
            '',
          ]),
        ].join('\n'),
        output: Output.object({ schema: supportResultSchema }),
        temperature: 0,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      return { results: output.results, tokens: usage.totalTokens ?? 0 };
    }),
  );
  return {
    results: out.flatMap((o) => o.results),
    tokens: out.reduce((n, o) => n + o.tokens, 0),
  };
}

/**
 * Takes out the lines the check found unsupported or only partly supported, and says why, so the
 * writer can narrow them. A line the check did not answer for is kept: a missing answer is not a
 * finding against it.
 */
export function dropUnsupported(
  sections: LaunchSection[],
  results: SupportResult[],
): { sections: LaunchSection[]; dropped: DroppedLine[] } {
  const verdict = new Map(results.map((r) => [r.id, r]));
  const dropped: DroppedLine[] = [];
  const kept = sections.flatMap((s) => {
    const lines = s.lines.filter((l) => {
      const r = verdict.get(l.id);
      if (!r || r.support === 'supported') return true;
      dropped.push({
        section: s.key,
        text: l.text,
        why: `It says more than the findings it cites show${r.reason ? `: ${r.reason}` : ''}`,
      });
      return false;
    });
    return lines.length ? [{ ...s, lines }] : [];
  });
  return { sections: kept, dropped };
}
