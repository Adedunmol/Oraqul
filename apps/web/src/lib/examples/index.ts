import { type OutputDetail, outputDetailSchema } from '@oraqul/schema';
import film from './film.json';
import music from './music.json';
import podcasts from './podcasts.json';

// Recorded by `apps/api/src/agent/examples.spec.ts` from the plan the pipeline writes on the demo
// data, so the examples show what the product writes today. Checked here, where they are read.
export const exampleDetails: Record<'film' | 'music' | 'podcasts', OutputDetail> = {
  film: outputDetailSchema.parse(film),
  music: outputDetailSchema.parse(music),
  podcasts: outputDetailSchema.parse(podcasts),
};
