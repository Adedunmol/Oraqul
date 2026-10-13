import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext, tools } from '@oraqul/engine';

/**
 * Exposes the engine tools, the same ones the agents call (spec §1). Each result is
 * `{ data, receipt }` as JSON text, so a client can cite the receipt.
 */
export function createServer(context: ToolContext): McpServer {
  const server = new McpServer({ name: 'oraqul', version: '0.0.0' });

  for (const tool of Object.values(tools)) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.input.shape },
      async (args) => {
        try {
          const result = await tool.run(context, args);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (err) {
          // A failed Qloo call or a spent budget is an answer the client can read, not a crash.
          const message = err instanceof Error ? err.message : 'Tool failed';
          return { isError: true, content: [{ type: 'text', text: message }] };
        }
      },
    );
  }
  return server;
}
