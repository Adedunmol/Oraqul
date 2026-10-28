import { type OutputDetail, outputDetailSchema } from '@oraqul/schema';
import books from './books.json';
import briefs from './briefs.json';
import film from './film.json';
import music from './music.json';
import podcasts from './podcasts.json';

export type ExampleId = 'film' | 'music' | 'books' | 'podcasts';

// Real runs on live Qloo data, recorded by the live runner (`RECORD_EXAMPLES=1`, docs/testing.md)
// and redacted as a share link is: receipts keep their rule and confidence, never what was sent or
// returned. `apps/api/src/agent/examples.spec.ts` keeps them fit to show. Checked here, where they
// are read.
export const exampleDetails: Record<ExampleId, OutputDetail> = {
  film: outputDetailSchema.parse(film),
  music: outputDetailSchema.parse(music),
  books: outputDetailSchema.parse(books),
  podcasts: outputDetailSchema.parse(podcasts),
};

/** What the person wrote for each example, shown above its plan. */
export const exampleBriefs: Record<ExampleId, string> = briefs;
