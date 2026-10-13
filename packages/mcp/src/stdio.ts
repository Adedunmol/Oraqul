import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { contextFromEnv } from './context';
import { createServer } from './server';

// stdout carries the protocol, so anything human-readable goes to stderr.
async function main() {
  const context = contextFromEnv(process.env);
  await createServer(context).connect(new StdioServerTransport());
  console.error(`oraqul mcp ready (${context.source} data)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
