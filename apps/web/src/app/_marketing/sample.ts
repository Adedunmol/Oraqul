import type { Confidence, Verdict } from '@oraqul/schema';

/** An invented line for previews. None of it is Qloo data, and every preview says "Example". */
export interface SampleLine {
  id: string;
  claim: string;
  detail: string;
  verdict: Verdict;
  confidence: Confidence;
  receipt: { callId: string; input: string; returned: string; decided: string };
}

export const planPrompt =
  'Plan the release of Harmattan, a Lagos crime drama, for the UK and the US.';

export const heroLines: SampleLine[] = [
  {
    id: 'core',
    claim: 'Fans of Nigerian crime thrillers are your core audience.',
    detail: 'Their taste overlaps with your lead in Lagos and London.',
    verdict: 'holds',
    confidence: 'high',
    receipt: {
      callId: 'call_8f3a',
      input: 'Lead title, Lagos and London, ages 25 to 34',
      returned: 'Taste overlap well above a neutral audience in the same places',
      decided: 'Computed by code from the values returned, against the published rule',
    },
  },
  {
    id: 'market',
    claim: 'The UK is the right first market.',
    detail: 'A stronger first market came back, and it is now in the plan.',
    verdict: 'breaks',
    confidence: 'medium',
    receipt: {
      callId: 'call_2c71',
      input: 'Lead title, UK and Canada, ages 25 to 34',
      returned: 'Canada ranked above the UK on taste fit',
      decided: 'Computed by code: the UK fell below the plan’s own baseline',
    },
  },
  {
    id: 'second',
    claim: 'Johannesburg is worth a second wave.',
    detail: 'Thin data for this place. Treat it as a draft.',
    verdict: 'weak',
    confidence: 'lower',
    receipt: {
      callId: 'call_b904',
      input: 'Lead title, Johannesburg, ages 25 to 34',
      returned: 'A small signal from few comparable titles',
      decided: 'Computed by code: usable but below the strong threshold, confidence capped',
    },
  },
];
