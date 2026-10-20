import type { LanguageModel } from 'ai';
import {
  followUpSystem,
  ModelFollowUpReader as LaunchModelFollowUpReader,
} from '../launch/follow-up.js';

export const FOLLOW_UP_SYSTEM = followUpSystem(
  'game',
  'games',
  'partners from another medium the person wants to collaborate with: an artist or band, a series or anime, a film, a brand, a podcast or another game, exactly as written. Not comparable games.',
);

export class ModelFollowUpReader extends LaunchModelFollowUpReader {
  constructor(model: LanguageModel, timeoutMs: number) {
    super(model, timeoutMs, FOLLOW_UP_SYSTEM);
  }
}
