import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Controller, Delete, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { McpService } from './mcp.service.js';
import { type McpRequest, TokenGuard } from './token.guard.js';

/**
 * The hosted MCP server over streamable HTTP (spec §5.22). Every call is authenticated by a personal
 * access token, never a session. It is stateless: each request gets its own server, acting as the
 * token's person, so a revoked token stops working on its next call.
 */
@Controller('mcp')
@UseGuards(TokenGuard)
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Post()
  async call(@Req() req: McpRequest, @Res() res: Response): Promise<void> {
    const server = this.mcp.serverFor(req.principal);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  // There is no stream to open and no session to end: the server holds no state between calls.
  @Get()
  @HttpCode(405)
  noStream(@Res() res: Response): void {
    res.setHeader('Allow', 'POST').json({ error: 'Use POST. This server holds no sessions.' });
  }

  @Delete()
  @HttpCode(405)
  noSession(@Res() res: Response): void {
    res.setHeader('Allow', 'POST').json({ error: 'Use POST. This server holds no sessions.' });
  }
}
