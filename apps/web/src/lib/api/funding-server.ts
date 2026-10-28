import { type FundingState, fundingStateSchema } from '@oraqul/schema';
import { serverGet } from './server';

export function getFunding(outputId: string, returnTo: string): Promise<FundingState> {
  return serverGet(`/outputs/${outputId}/funding`, fundingStateSchema, { returnTo });
}
