import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  type ExtractRulesInput,
  extractRulesSchema,
  rejectRuleSchema,
  type TeamRulesResponse,
} from '@oraqul/schema';
import type { z } from 'zod';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { type Membership, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard, VerifiedGuard } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { type Extracted, TeamRulesService } from './team-rules.service.js';

/** The team's defaults (spec §7). Anyone who runs the agent may propose; only an owner decides. */
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
    return this.rules.extract(teamId, membership.userId, body as ExtractRulesInput);
  }

  @Post(':ruleId/confirm')
  @Roles('owner')
  @HttpCode(200)
  async confirm(
    @Param('teamId') teamId: string,
    @Param('ruleId') ruleId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<TeamRulesResponse> {
    return { rules: await this.rules.confirm(teamId, ruleId, membership.userId) };
  }

  @Post(':ruleId/reject')
  @Roles('owner')
  @HttpCode(200)
  async reject(
    @Param('teamId') teamId: string,
    @Param('ruleId') ruleId: string,
    @Body(new ZodPipe(rejectRuleSchema)) body: z.output<typeof rejectRuleSchema>,
  ): Promise<TeamRulesResponse> {
    return { rules: await this.rules.reject(teamId, ruleId, body.reason) };
  }

  @Post(':ruleId/archive')
  @Roles('owner')
  @HttpCode(200)
  async archive(
    @Param('teamId') teamId: string,
    @Param('ruleId') ruleId: string,
  ): Promise<TeamRulesResponse> {
    return { rules: await this.rules.archive(teamId, ruleId) };
  }
}
