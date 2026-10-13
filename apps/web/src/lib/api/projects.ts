import { type DemoProjectsResponse, demoProjectsResponseSchema } from '@oraqul/schema';
import { serverGet } from './server';

export function getDemoProjects(): Promise<DemoProjectsResponse> {
  return serverGet('/demo/projects', demoProjectsResponseSchema);
}
