import type { LanguageModel } from 'ai';
import {
  followUpSystem,
  ModelFollowUpReader as LaunchModelFollowUpReader,
} from '../launch/follow-up.js';

export const FOLLOW_UP_SYSTEM = followUpSystem(
  'book',
  'books',
  'series or films the person wants to compare the book with for a screen angle, exactly as written. Not comparable books.',
);

export class ModelFollowUpReader extends LaunchModelFollowUpReader {
  constructor(model: LanguageModel, timeoutMs: number) {
    super(model, timeoutMs, FOLLOW_UP_SYSTEM);
  }
}
