import type { Receipt, ToolName } from '@oraqul/schema';
import type { z } from 'zod';
import type { QlooClient } from '../qloo/client';
import type { ToolResult } from '../receipts';

export interface ToolContext {
  /** One client per run, so the call budget and the cache are the run's. */
  qloo: QlooClient;
  source: Receipt['source'];
}

/** What the model and MCP clients see in `data`. Plain JSON, so it can sit on a receipt too. */
export type ToolData = Receipt['returned'];

export interface Tool {
  name: ToolName;
  description: string;
  /** An object, because MCP describes tool inputs as a set of named fields. */
  input: z.ZodObject;
  /** Parses `raw` against `input`, so callers pass whatever the model or an MCP client sent. */
  run(ctx: ToolContext, raw: unknown): Promise<ToolResult<ToolData>>;
}

interface ToolDefinition<I extends z.ZodObject> {
  name: ToolName;
  description: string;
  input: I;
  run(ctx: ToolContext, input: z.output<I>): Promise<ToolResult<ToolData>>;
}

export function defineTool<I extends z.ZodObject>(definition: ToolDefinition<I>): Tool {
  return {
    name: definition.name,
    description: definition.description,
    input: definition.input,
    run: async (ctx, raw) => definition.run(ctx, definition.input.parse(raw)),
  };
}
