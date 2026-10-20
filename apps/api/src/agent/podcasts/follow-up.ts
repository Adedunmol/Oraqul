import type { LanguageModel } from 'ai';
import {
  followUpSystem,
  ModelFollowUpReader as LaunchModelFollowUpReader,
} from '../launch/follow-up.js';

export const FOLLOW_UP_SYSTEM = followUpSystem(
  'podcast',
  'shows',
  'shows the person wants to swap trailers, ads or guests with, exactly as written. Not comparable shows.',
);

export class ModelFollowUpReader extends LaunchModelFollowUpReader {
  constructor(model: LanguageModel, timeoutMs: number) {
    super(model, timeoutMs, FOLLOW_UP_SYSTEM);
  }
}
