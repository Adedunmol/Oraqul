import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  type Category,
  type CreateProjectResult,
  type CreateThreadResult,
  categorySchema,
  createProjectInputSchema,
  type Overview,
  type Project,
  type ProjectDetail,
  postMessageSchema,
  type ThreadDetail,
} from '@oraqul/schema';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';
import { RunService } from '../agent/run.service.js';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { type Membership, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard, type SessionUser } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { ProjectsService } from './projects.service.js';

const scopeSchema = z
  .union([categorySchema, z.literal('all')])
  .optional()
  .transform((scope) => (scope === 'all' ? undefined : scope));
const afterSchema = z.coerce.number().int().min(0).default(0);

// Roles per action: docs/product/spec.md section 7. Owners and editors write, viewers read.
@Controller()
@UseGuards(SessionGuard, RolesGuard)
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly runs: RunService,
  ) {}

  @Get('teams/:teamId/projects')
  @Roles('owner', 'editor', 'viewer')
  list(
    @CurrentMembership() membership: Membership,
    @Query('category', new ZodPipe(scopeSchema)) category: Category | undefined,
  ): Promise<Project[]> {
    return this.projects.list(membership.teamId, category);
  }

  @Post('teams/:teamId/projects')
  @Roles('owner', 'editor')
  create(
    @CurrentMembership() membership: Membership,
    @Body(new ZodPipe(createProjectInputSchema)) body: z.output<typeof createProjectInputSchema>,
  ): Promise<CreateProjectResult> {
    return this.runs.createProject(membership.teamId, membership.userId, body);
  }

  @Get('teams/:teamId/overview')
  @Roles('owner', 'editor', 'viewer')
  overview(@CurrentMembership() membership: Membership): Promise<Overview> {
    return this.projects.overview(membership.teamId, membership.userId);
  }

  @Get('projects/:projectId')
  @Roles('owner', 'editor', 'viewer')
  detail(
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
  ): Promise<ProjectDetail> {
    return this.projects.detail(projectId, membership.userId, membership.role);
  }

  @Delete('projects/:projectId')
  @Roles('owner')
  @HttpCode(204)
  remove(@Param('projectId') projectId: string): Promise<void> {
    return this.projects.delete(projectId);
  }

  @Post('projects/:projectId/threads')
  @Roles('owner', 'editor')
  createThread(
    @CurrentUser() user: SessionUser,
    @Param('projectId') projectId: string,
  ): Promise<CreateThreadResult> {
    return this.projects.createThread(projectId, user.id);
  }

  @Get('threads/:threadId')
  @Roles('owner', 'editor', 'viewer')
  thread(@Param('threadId') threadId: string): Promise<ThreadDetail> {
    return this.projects.threadDetail(threadId);
  }

  /** Returns once the message is saved; the agent's reply arrives on the event stream. */
  @Post('threads/:threadId/messages')
  @Roles('owner', 'editor')
  @HttpCode(202)
  post(
    @Param('threadId') threadId: string,
    @Body(new ZodPipe(postMessageSchema)) body: z.output<typeof postMessageSchema>,
  ): Promise<void> {
    return this.runs.post(threadId, body);
  }

  @Post('threads/:threadId/read')
  @Roles('owner', 'editor', 'viewer')
  @HttpCode(204)
  read(@CurrentUser() user: SessionUser, @Param('threadId') threadId: string): Promise<void> {
    return this.projects.markRead(threadId, user.id);
  }

  /** Spec §8. Each stored event carries its seq as the SSE id; `?after=` resumes after one. */
  @Sse('threads/:threadId/events')
  @Roles('owner', 'editor', 'viewer')
  events(
    @Param('threadId') threadId: string,
    @Query('after', new ZodPipe(afterSchema)) after: number,
  ): Observable<MessageEvent> {
    return this.runs
      .events(threadId, after)
      .pipe(
        map(({ seq, event }) =>
          seq === undefined ? { data: event } : { id: String(seq), data: event },
        ),
      );
  }
}
