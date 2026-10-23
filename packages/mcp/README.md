# @oraqul/mcp

MCP server over the engine tools, the same objects the agents call. Stdio transport.

```
pnpm --filter @oraqul/mcp build
node packages/mcp/dist/stdio.js      # demo data; set QLOO_MODE=live with a key for real Qloo
```

Each tool returns `{ data, receipts }` as JSON text: its data and one receipt for each Qloo call it made. Details: [docs/backend/agent.md](../../docs/backend/agent.md#mcp).
