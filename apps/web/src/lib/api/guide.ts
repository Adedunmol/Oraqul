import { type GuideAnswer, type GuideAsk, guideAnswerSchema } from '@oraqul/schema';
import { clientRequest } from './client';

export function askGuide(body: GuideAsk): Promise<GuideAnswer> {
  return clientRequest(
    '/guide/ask',
    { method: 'POST', body, redirectOn401: false },
    guideAnswerSchema,
  );
}
