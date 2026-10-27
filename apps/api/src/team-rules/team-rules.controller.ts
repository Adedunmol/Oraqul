import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { type ExtractRulesInput, extractRulesSchema, type TeamRulesResponse } from '@oraqul/schema';
import type { z } from 'zod';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { type Membership, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard, VerifiedGuard } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { type Extracted, TeamRulesService } from './team-rules.service.js';

/** The team's defaults (spec §7). An owner or editor saves and removes rules; everyone reads them. */
@Controller('teams/:teamId/rules')
@UseGuards(SessionGuard, RolesGuard)
export class TeamRulesController {
  constructor(private readonly rules: TeamRulesService) {}

  @Get()
  @Roles('owner', 'editor', 'viewer')
  async list(@Param('teamId') teamId: string): Promise<TeamRulesResponse> {
    return { rules: await this.rules.list(teamId) };
  }

  @Post('extract')
  @Roles('owner', 'editor')
  @UseGuards(VerifiedGuard)
  @HttpCode(200)
  extract(
    @Param('teamId') teamId: string,
    @Body(new ZodPipe(extractRulesSchema)) body: z.output<typeof extractRulesSchema>,
    @CurrentMembership() membership: Membership,
  ): Promise<Extracted> {
    return this.rules.extract(
      teamId,
      membership.userId,
      body as ExtractRulesInput,
      membership.role,
    );
  }

  @Post(':ruleId/archive')
  @Roles('owner', 'editor')
  @HttpCode(200)
  async archive(
    @Param('teamId') teamId: string,
    @Param('ruleId') ruleId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<TeamRulesResponse> {
    return { rules: await this.rules.archive(teamId, ruleId, membership.role) };
  }
}
