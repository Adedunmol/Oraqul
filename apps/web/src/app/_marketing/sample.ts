import type { Confidence, Verdict } from '@oraqul/schema';
import { exampleDetails } from '@/lib/examples';

/** A line of the recorded film example, in words, for previews. Every preview says "Example". */
export interface SampleLine {
  id: string;
  claim: string;
  detail: string;
  verdict: Verdict;
  confidence: Confidence;
  receipt: { callId: string; input: string; returned: string; decided: string };
}

const { output } = exampleDetails.film;

// The three cities of the recorded run, in the team's order, so the preview shows each city's
// line with its own call. Rerecording the film example can change which ones hold.
const CITIES = ['a-place-atlanta', 'a-place-new-york', 'a-place-london'];

export const heroLines: SampleLine[] = CITIES.flatMap((id) => {
  const assumption = output.brief.assumptions.find((a) => a.id === id);
  const finding = output.plan?.findings.find((f) => f.id === `f-${id}`);
  const receipt = output.receipts.find((r) => r.lineId === id);
  if (!assumption || !finding || !receipt) return [];
  const comps = output.plan?.comps.map((c) => c.name).join(', ');
  return [
    {
      id,
      claim: assumption.text,
      detail: assumption.fix ?? assumption.why,
      verdict: assumption.verdict,
      confidence: finding.confidence,
      receipt: {
        callId: `call_${receipt.callId.slice(0, 4)}`,
        input: `${comps ?? 'The comps'}, in ${finding.context.city ?? 'the city'}`,
        returned: finding.text,
        decided: 'Computed by code from the values returned, against the published rule',
      },
    },
  ];
});
