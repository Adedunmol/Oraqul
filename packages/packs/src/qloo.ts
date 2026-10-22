import type { QlooCoverage } from '@oraqul/schema';

/** What every category asks Qloo about besides its own titles: people, brands and geography. */
export const sharedQlooCoverage: Omit<QlooCoverage, 'titles'> = {
  talent: ['urn:entity:person'],
  partners: ['urn:entity:brand'],
  places: ['urn:entity:place'],
};
