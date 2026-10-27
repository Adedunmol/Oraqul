import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { type ApiTokensResponse, type CreatedToken, createTokenSchema } from '@oraqul/schema';
import type { z } from 'zod';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { type Membership, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard, VerifiedGuard } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { TokensService } from './tokens.service.js';

/**
 * A person's own tokens for a team (spec §7). These routes need a signed in session, never a token:
 * an MCP client cannot make or revoke tokens.
 */
@Controller('teams/:teamId/tokens')
@UseGuards(SessionGuard, RolesGuard)
export class TokensController {
  constructor(private readonly tokens: TokensService) {}

  @Get()
  @Roles('owner', 'editor', 'viewer')
  async list(@CurrentMembership() membership: Membership): Promise<ApiTokensResponse> {
    return { tokens: await this.tokens.list(membership.userId, membership.teamId) };
  }

  @Post()
  @Roles('owner', 'editor', 'viewer')
  @UseGuards(VerifiedGuard)
  create(
    @Body(new ZodPipe(createTokenSchema)) body: z.output<typeof createTokenSchema>,
    @CurrentMembership() membership: Membership,
  ): Promise<CreatedToken> {
    return this.tokens.create(membership.userId, membership.teamId, body);
  }

  @Delete(':tokenId')
  @Roles('owner', 'editor', 'viewer')
  @HttpCode(200)
  async revoke(
    @Param('tokenId') tokenId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<ApiTokensResponse> {
    return { tokens: await this.tokens.revoke(membership.userId, membership.teamId, tokenId) };
  }
}
