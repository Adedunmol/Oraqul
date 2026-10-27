import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { type SavedDefaults, saveDefaultsSchema, type TeamDefaults } from '@oraqul/schema';
import type { z } from 'zod';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { type Membership, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard, VerifiedGuard } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { TeamRulesService } from './team-rules.service.js';

/** The team's defaults (spec §7). An owner or editor saves them; everyone reads them. */
@Controller('teams/:teamId/rules')
@UseGuards(SessionGuard, RolesGuard)
export class TeamRulesController {
  constructor(private readonly rules: TeamRulesService) {}

  @Get()
  @Roles('owner', 'editor', 'viewer')
  current(@Param('teamId') teamId: string): Promise<TeamDefaults> {
    return this.rules.current(teamId);
  }

  /** Saves the words and makes the rules they hold the ones in force. */
  @Put()
  @Roles('owner', 'editor')
  @UseGuards(VerifiedGuard)
  save(
    @Param('teamId') teamId: string,
    @Body(new ZodPipe(saveDefaultsSchema)) body: z.output<typeof saveDefaultsSchema>,
    @CurrentMembership() membership: Membership,
  ): Promise<SavedDefaults> {
    return this.rules.save(teamId, membership.userId, body.text, membership.role);
  }
}
