import type { ToolName } from '@oraqul/schema';
import { audienceBySegment } from './audience-by-segment';
import { searchEntity } from './search-entity';
import type { Tool } from './tool';

export type { Tool, ToolContext, ToolData } from './tool';

export const tools: Record<ToolName, Tool> = { searchEntity, audienceBySegment };
