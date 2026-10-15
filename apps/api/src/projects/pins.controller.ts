import { Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import type { PinnedProjects } from '@oraqul/schema';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard, type SessionUser } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { ProjectsService } from './projects.service.js';

const projectIdPipe = new ZodPipe(z.uuid());

/** One person's pins (spec §7). Each answer is the full list after the change, newest first. */
@Controller('me/pins')
@UseGuards(SessionGuard)
export class PinsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<PinnedProjects> {
    return this.projects.pins(user.id);
  }

  /** Only a project the person can read, so the guard checks their role in its team. */
  @Put(':projectId')
  @UseGuards(RolesGuard)
  @Roles('owner', 'editor', 'viewer')
  pin(
    @CurrentUser() user: SessionUser,
    @Param('projectId', projectIdPipe) projectId: string,
  ): Promise<PinnedProjects> {
    return this.projects.pin(user.id, projectId);
  }

  /** Removing one's own pin needs no team role: someone who left the team can still tidy up. */
  @Delete(':projectId')
  unpin(
    @CurrentUser() user: SessionUser,
    @Param('projectId', projectIdPipe) projectId: string,
  ): Promise<PinnedProjects> {
    return this.projects.unpin(user.id, projectId);
  }
}
