import {
  type MeResponse,
  meResponseSchema,
  type RunAllowance,
  runAllowanceSchema,
} from '@oraqul/schema';
import { serverGet } from './server';

export function getMe(returnTo: string): Promise<MeResponse> {
  return serverGet('/auth/me', meResponseSchema, { returnTo });
}

/** How many runs the person has used this month, out of how many. */
export function getRunAllowance(returnTo: string): Promise<RunAllowance> {
  return serverGet('/me/runs', runAllowanceSchema, { returnTo });
}
