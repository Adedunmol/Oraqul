import type { Confidence } from '@oraqul/schema';

// The rule and its thresholds are docs/product/spec.md section 5.1. Change them there first.

/** `popularity` at or above this makes an anchor known. Missing popularity is not known. */
export const KNOWN_POPULARITY = 0.3;
/** A place with fewer cells than this is not ranked. */
export const MIN_PLACE_CELLS = 25;
const SOLID_PLACE_CELLS = 100;

export interface ConfidenceInput {
  /**
   * Audience lines: anchors that returned a demographics row. Place and scoring lines: anchors
   * whose leave one out rerun moved a value the line used.
   */
  anchorsWithData: number;
  /** Of `anchorsWithData`, those with `popularity` at or above `KNOWN_POPULARITY`. */
  knownAnchors: number;
  /**
   * Place and scoring lines with 3 or more anchors. `skipped` when the call budget would not
   * cover the reruns. Leave it out where the check does not apply.
   */
  leaveOneOut?:
    | { result: 'holds' }
    | { result: 'changes'; restsOn: string }
    | { result: 'skipped' };
  /** The deciding value sits near a band edge (`isNearEdge`). */
  nearEdge?: boolean;
  /** Cells behind a ranked place. */
  cells?: number;
  /** Read from a stand-in, such as the genre's audience in place of the comps'. */
  standIn?: string;
  /** The line could not be tested, or its call failed. */
  cannotTest?: boolean;
}

export interface ConfidenceResult {
  level: Confidence;
  /** The check that set the level, for the receipt's rule. */
  reason: string;
}

const order: Record<Confidence, number> = { lower: 0, medium: 1, high: 2 };

/** Spec §5.1: every check sets a ceiling and the line takes the lowest. */
export function confidenceFor(input: ConfidenceInput): ConfidenceResult {
  if (input.cannotTest) return { level: 'lower', reason: 'lower: this line could not be tested' };
  if (input.cells !== undefined && input.cells < MIN_PLACE_CELLS) {
    return { level: 'lower', reason: `lower: ${input.cells} cells, too few to rank the place` };
  }
  if (input.standIn) return { level: 'lower', reason: `lower: read from ${input.standIn}` };

  const ceilings: ConfidenceResult[] = [anchorCeiling(input), knownCeiling(input)];
  const loo = input.leaveOneOut;
  if (loo?.result === 'changes') {
    ceilings.push({ level: 'lower', reason: `lower: the result rests on ${loo.restsOn}` });
  } else if (loo?.result === 'skipped') {
    ceilings.push({
      level: 'medium',
      reason: 'medium: the call budget did not cover the leave one out check',
    });
  }
  if (input.nearEdge) {
    ceilings.push({ level: 'medium', reason: 'medium: the value is close to a band edge' });
  }
  if (input.cells !== undefined && input.cells < SOLID_PLACE_CELLS) {
    ceilings.push({ level: 'medium', reason: `medium: ${input.cells} cells behind the place` });
  }

  const lowest = ceilings.reduce((low, c) => (order[c.level] < order[low.level] ? c : low));
  if (lowest.level !== 'high') return lowest;
  const held = loo?.result === 'holds' ? ', and it holds when each is left out' : '';
  return {
    level: 'high',
    reason: `high: ${input.anchorsWithData} anchors with data, ${input.knownAnchors} well known${held}`,
  };
}

function anchorCeiling({ anchorsWithData: n }: ConfidenceInput): ConfidenceResult {
  if (n >= 3) return { level: 'high', reason: '' };
  if (n === 2) return { level: 'medium', reason: 'medium: 2 anchors with data' };
  return { level: 'lower', reason: `lower: ${n} anchor${n === 1 ? '' : 's'} with data` };
}

function knownCeiling({ knownAnchors: n }: ConfidenceInput): ConfidenceResult {
  if (n >= 2) return { level: 'high', reason: '' };
  if (n === 1) return { level: 'medium', reason: 'medium: only 1 anchor Qloo knows well' };
  return { level: 'lower', reason: 'lower: no anchor Qloo knows well' };
}

/** Counts anchors Qloo knows well. `null` popularity is thin data, never zero. */
export function countKnown(popularities: (number | null)[]): number {
  return popularities.filter((p) => p !== null && p >= KNOWN_POPULARITY).length;
}
