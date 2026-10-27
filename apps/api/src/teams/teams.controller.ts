import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  changeRoleSchema,
  createInviteSchema,
  createTeamSchema,
  type InviteSummary,
  renameTeamSchema,
  type TeamDetail,
  type TeamSummary,
  type TeamsResponse,
} from '@oraqul/schema';
import { z } from 'zod';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { type Membership, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard, type SessionUser } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { InvitesService } from './invites.service.js';
import { TeamsService } from './teams.service.js';

const userIdPipe = new ZodPipe(z.uuid());

@Controller('teams')
@UseGuards(SessionGuard)
export class TeamsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly invites: InvitesService,
  ) {}

  @Get()
  async list(@CurrentUser() user: SessionUser): Promise<TeamsResponse> {
    return { teams: await this.teams.list(user.id) };
  }

  @Post()
  create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(createTeamSchema)) body: z.infer<typeof createTeamSchema>,
  ): Promise<TeamSummary> {
    return this.teams.create(user.id, body.name);
  }

  @Get(':teamId')
  @UseGuards(RolesGuard)
  @Roles('owner', 'editor', 'viewer')
  detail(@CurrentMembership() membership: Membership): Promise<TeamDetail> {
    return this.teams.detail(membership.teamId, membership.role);
  }

  @Patch(':teamId')
  @UseGuards(RolesGuard)
  @Roles('owner')
  @HttpCode(204)
  rename(
    @CurrentMembership() membership: Membership,
    @Body(new ZodPipe(renameTeamSchema)) body: z.infer<typeof renameTeamSchema>,
  ): Promise<void> {
    return this.teams.rename(membership.teamId, body.name);
  }

  @Patch(':teamId/members/:userId')
  @UseGuards(RolesGuard)
  @Roles('owner')
  @HttpCode(204)
  changeRole(
    @CurrentMembership() membership: Membership,
    @Param('userId', userIdPipe) userId: string,
    @Body(new ZodPipe(changeRoleSchema)) body: z.infer<typeof changeRoleSchema>,
  ): Promise<void> {
    return this.teams.changeRole(membership.teamId, userId, body.role);
  }

  @Delete(':teamId/members/:userId')
  @UseGuards(RolesGuard)
  @Roles('owner')
  @HttpCode(204)
  removeMember(
    @CurrentMembership() membership: Membership,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<void> {
    return this.teams.removeMember(membership.teamId, userId);
  }

  @Post(':teamId/invites')
  @UseGuards(RolesGuard)
  @Roles('owner')
  invite(
    @CurrentMembership() membership: Membership,
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(createInviteSchema)) body: z.infer<typeof createInviteSchema>,
  ): Promise<InviteSummary> {
    return this.invites.create(membership.teamId, user, body);
  }

  @Delete(':teamId/invites/:inviteId')
  @UseGuards(RolesGuard)
  @Roles('owner')
  @HttpCode(204)
  revokeInvite(
    @CurrentMembership() membership: Membership,
    @Param('inviteId', userIdPipe) inviteId: string,
  ): Promise<void> {
    return this.invites.revoke(membership.teamId, inviteId);
  }
}
