import type { LanguageModel } from 'ai';
import {
  followUpSystem,
  ModelFollowUpReader as LaunchModelFollowUpReader,
} from '../launch/follow-up.js';

export {
  type Change,
  decideFollowUp,
  FallbackFollowUpReader,
  type FollowUp,
  type FollowUpInput,
  type FollowUpReader,
  type FollowUpReading,
  followUpReadingSchema,
  ScriptedFollowUpReader,
} from '../launch/follow-up.js';

export const FOLLOW_UP_SYSTEM = followUpSystem('film or series', 'films or series');

export class ModelFollowUpReader extends LaunchModelFollowUpReader {
  constructor(model: LanguageModel, timeoutMs: number) {
    super(model, timeoutMs, FOLLOW_UP_SYSTEM);
  }
}
