# @oraqul/mcp

MCP server over the engine tools, the same objects the agents call. Stdio transport, the Qloo tools only: it has no accounts and is not hosted. The hosted server, which exposes the plan pipeline and never these raw tools, is in `apps/api/src/mcp-http` ([spec §5.22](../../docs/product/spec.md)).

```
pnpm --filter "@oraqul/mcp..." build
node packages/mcp/dist/stdio.js      # demo data; set QLOO_MODE=live with a key for real Qloo
```

Each tool returns `{ data, receipts }` as JSON text: its data and one receipt for each Qloo call it made. Details: [docs/backend/agent.md](../../docs/backend/agent.md#mcp).
