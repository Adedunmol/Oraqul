import { z } from 'zod';

export const verdictSchema = z.enum(['holds', 'weak', 'breaks', 'cant']);
export type Verdict = z.infer<typeof verdictSchema>;

export const confidenceSchema = z.enum(['high', 'medium', 'lower']);
export type Confidence = z.infer<typeof confidenceSchema>;

export const fitBandSchema = z.enum(['recommended', 'usable', 'not_recommended']);
export type FitBand = z.infer<typeof fitBandSchema>;
