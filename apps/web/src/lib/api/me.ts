import { type MeResponse, meResponseSchema } from '@oraqul/schema';
import { serverGet } from './server';

export function getMe(returnTo: string): Promise<MeResponse> {
  return serverGet('/auth/me', meResponseSchema, { returnTo });
}
