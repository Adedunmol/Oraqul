import { z } from 'zod';

export const verdictSchema = z.enum(['holds', 'weak', 'breaks', 'cant']);
export type Verdict = z.infer<typeof verdictSchema>;

export const confidences = ['high', 'medium', 'lower'] as const;
export const confidenceSchema = z.enum(confidences);
export type Confidence = z.infer<typeof confidenceSchema>;

export const fitBandSchema = z.enum(['recommended', 'usable', 'not_recommended']);
export type FitBand = z.infer<typeof fitBandSchema>;

/**
 * A call on a decision (a release date, a territory, a partner), set by code from what Qloo
 * returned. Assumptions keep their own verdicts; this is the direction for what to do.
 */
export const directionSchema = z.enum(['okay', 'risky', 'avoid']);
export type Direction = z.infer<typeof directionSchema>;
