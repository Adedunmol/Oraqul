import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  Sse,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  type CampaignAction,
  type CampaignState,
  type CampaignTest,
  type Category,
  type CompareResponse,
  type CreateProjectResult,
  type CreateThreadInput,
  type CreateThreadResult,
  categorySchema,
  createProjectInputSchema,
  createThreadInputSchema,
  type MemoryItem,
  type OutputDetail,
  type Overview,
  type PartnersState,
  type Project,
  type ProjectDetail,
  postMessageSchema,
  type ReactionState,
  type SetPartners,
  type SetReaction,
  type ShareState,
  setPartnersSchema,
  setReactionSchema,
  setShareSchema,
  setTestResultsSchema,
  type TestResults,
  type ThreadDetail,
  type UpdateCampaignAction,
  type UpdateMemoryInput,
  updateCampaignActionSchema,
  updateMemoryInputSchema,
} from '@oraqul/schema';
import type { Response } from 'express';
import { interval, map, merge, type Observable } from 'rxjs';
import { z } from 'zod';
import { RunService } from '../agent/run.service.js';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { type Membership, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard, type SessionUser, VerifiedGuard } from '../auth/session.guard.js';
import { exportFormats, fileName, toDocx, toMarkdown, toPdf } from '../outputs/export.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { CampaignService } from './campaign.service.js';
import { PartnersService } from './partners.service.js';
import { ProjectsService } from './projects.service.js';
import { ReactionsService } from './reactions.service.js';
import { SharesService } from './shares.service.js';

const scopeSchema = z
  .union([categorySchema, z.literal('all')])
  .optional()
  .transform((scope) => (scope === 'all' ? undefined : scope));
const afterSchema = z.coerce.number().int().min(0).default(0);
const KEEPALIVE_MS = 20_000;

// Roles per action: docs/product/spec.md section 7. Owners and editors write, viewers read.
@Controller()
@UseGuards(SessionGuard, RolesGuard)
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly runs: RunService,
    private readonly shares: SharesService,
    private readonly partners: PartnersService,
    private readonly reactions: ReactionsService,
    private readonly campaign: CampaignService,
  ) {}

  @Get('teams/:teamId/projects')
  @Roles('owner', 'editor', 'viewer')
  list(
    @CurrentMembership() membership: Membership,
    @Query('category', new ZodPipe(scopeSchema)) category: Category | undefined,
  ): Promise<Project[]> {
    return this.projects.list(membership.teamId, category, membership.userId);
  }

  @Post('teams/:teamId/projects')
  @Roles('owner', 'editor')
  @UseGuards(VerifiedGuard)
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

  @Get('projects/:projectId/compare')
  @Roles('owner', 'editor', 'viewer')
  compare(
    @Param('projectId') projectId: string,
    @Query('a', new ZodPipe(z.uuid())) a: string,
    @Query('b', new ZodPipe(z.uuid())) b: string,
  ): Promise<CompareResponse> {
    return this.projects.compare(projectId, a, b);
  }

  @Delete('projects/:projectId')
  @Roles('owner')
  @HttpCode(204)
  remove(@Param('projectId') projectId: string): Promise<void> {
    return this.projects.delete(projectId);
  }

  @Post('projects/:projectId/threads')
  @Roles('owner', 'editor')
  @UseGuards(VerifiedGuard)
  createThread(
    @CurrentUser() user: SessionUser,
    @Param('projectId') projectId: string,
    @Body(new ZodPipe(createThreadInputSchema.prefault({}))) body: Required<CreateThreadInput>,
  ): Promise<CreateThreadResult> {
    return this.projects.createThread(projectId, user.id, body.fresh);
  }

  @Get('projects/:projectId/memory')
  @Roles('owner', 'editor', 'viewer')
  memory(@Param('projectId') projectId: string): Promise<MemoryItem[]> {
    return this.projects.memory(projectId);
  }

  @Put('projects/:projectId/memory/:itemId')
  @Roles('owner', 'editor')
  editMemory(
    @Param('projectId') projectId: string,
    @Param('itemId', new ZodPipe(z.uuid())) itemId: string,
    @Body(new ZodPipe(updateMemoryInputSchema)) body: UpdateMemoryInput,
  ): Promise<MemoryItem> {
    return this.projects.editMemory(projectId, itemId, body.text);
  }

  @Delete('projects/:projectId/memory/:itemId')
  @Roles('owner', 'editor')
  @HttpCode(204)
  forgetMemory(
    @Param('projectId') projectId: string,
    @Param('itemId', new ZodPipe(z.uuid())) itemId: string,
  ): Promise<void> {
    return this.projects.forgetMemory(projectId, itemId);
  }

  @Get('outputs/:outputId')
  @Roles('owner', 'editor', 'viewer')
  output(
    @CurrentUser() user: SessionUser,
    @Param('outputId') outputId: string,
  ): Promise<OutputDetail> {
    return this.projects.outputDetail(outputId, user.id);
  }

  /** Turns the read only link on or off (PRD O4). Turning it on again keeps the same address. */
  @Put('outputs/:outputId/share')
  @Roles('owner', 'editor')
  setShare(
    @Param('outputId') outputId: string,
    @Body(new ZodPipe(setShareSchema)) body: z.output<typeof setShareSchema>,
  ): Promise<ShareState> {
    return this.shares.set(outputId, body.enabled);
  }

  /** Replaces the team's own partners on the plan. Owners and editors only: it changes the plan. */
  @Put('outputs/:outputId/partners')
  @Roles('owner', 'editor')
  setPartners(
    @Param('outputId') outputId: string,
    @Body(new ZodPipe(setPartnersSchema)) body: SetPartners,
  ): Promise<PartnersState> {
    return this.partners.set(outputId, body.names);
  }

  /** Rates the plan useful or wrong, or takes the rating back. Any member may: it changes no data of the team's. */
  @Put('outputs/:outputId/reaction')
  @Roles('owner', 'editor', 'viewer')
  setReaction(
    @CurrentUser() user: SessionUser,
    @Param('outputId') outputId: string,
    @Body(new ZodPipe(setReactionSchema)) body: SetReaction,
  ): Promise<ReactionState> {
    return this.reactions.set(outputId, user.id, body.kind);
  }

  /** The plan's campaign: its calendar as actions, and the tests set up on them. */
  @Get('outputs/:outputId/campaign')
  @Roles('owner', 'editor', 'viewer')
  campaignState(@Param('outputId') outputId: string): Promise<CampaignState> {
    return this.campaign.state(outputId);
  }

  /** Makes the action set for this plan version. Asking again returns the set that exists. */
  @Post('outputs/:outputId/campaign')
  @Roles('owner', 'editor')
  setUpCampaign(@Param('outputId') outputId: string): Promise<CampaignState> {
    return this.campaign.setUp(outputId);
  }

  @Patch('outputs/:outputId/campaign/actions/:actionId')
  @Roles('owner', 'editor')
  updateAction(
    @Param('outputId') outputId: string,
    @Param('actionId', new ZodPipe(z.uuid())) actionId: string,
    @Body(new ZodPipe(updateCampaignActionSchema)) body: UpdateCampaignAction,
  ): Promise<CampaignAction> {
    return this.campaign.update(outputId, actionId, body);
  }

  @Put('outputs/:outputId/campaign/actions/:actionId/test')
  @Roles('owner', 'editor')
  addTest(
    @Param('outputId') outputId: string,
    @Param('actionId', new ZodPipe(z.uuid())) actionId: string,
  ): Promise<CampaignTest> {
    return this.campaign.addTest(outputId, actionId);
  }

  /** The team's own figures for the two angles. Code compares them; Oraqul names no winner by itself. */
  @Put('outputs/:outputId/campaign/actions/:actionId/test/results')
  @Roles('owner', 'editor')
  setTestResults(
    @Param('outputId') outputId: string,
    @Param('actionId', new ZodPipe(z.uuid())) actionId: string,
    @Body(new ZodPipe(setTestResultsSchema)) body: TestResults,
  ): Promise<CampaignTest> {
    return this.campaign.setTestResults(outputId, actionId, body);
  }

  @Delete('outputs/:outputId/campaign/actions/:actionId/test')
  @Roles('owner', 'editor')
  @HttpCode(204)
  removeTest(
    @Param('outputId') outputId: string,
    @Param('actionId', new ZodPipe(z.uuid())) actionId: string,
  ): Promise<void> {
    return this.campaign.removeTest(outputId, actionId);
  }

  /** The plan as a file to send or paste (PRD O3). */
  @Get('outputs/:outputId/export/:format')
  @Roles('owner', 'editor', 'viewer')
  async export(
    @Param('outputId') outputId: string,
    @Param('format', new ZodPipe(z.enum(exportFormats))) format: (typeof exportFormats)[number],
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { output } = await this.projects.outputDetail(outputId);
    const name = fileName(output, format);
    if (format === 'md') {
      res.set({ 'Content-Type': 'text/markdown; charset=utf-8' });
      return new StreamableFile(Buffer.from(toMarkdown(output), 'utf8'));
    }
    if (format === 'pdf') {
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}"`,
      });
      return new StreamableFile(await toPdf(output));
    }
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${name}"`,
    });
    return new StreamableFile(await toDocx(output));
  }

  @Get('threads/:threadId')
  @Roles('owner', 'editor', 'viewer')
  thread(@Param('threadId') threadId: string): Promise<ThreadDetail> {
    return this.projects.threadDetail(threadId);
  }

  /** Returns once the message is saved; the agent's reply arrives on the event stream. */
  @Post('threads/:threadId/messages')
  @Roles('owner', 'editor')
  @UseGuards(VerifiedGuard)
  @HttpCode(202)
  post(
    @Param('threadId') threadId: string,
    @Body(new ZodPipe(postMessageSchema)) body: z.output<typeof postMessageSchema>,
    @CurrentMembership() membership: Membership,
  ): Promise<void> {
    return this.runs.post(threadId, body, { userId: membership.userId, via: 'web' });
  }

  /** Stops the run on this thread. A conflict when nothing is running. */
  @Post('threads/:threadId/cancel')
  @Roles('owner', 'editor')
  @HttpCode(204)
  cancel(@Param('threadId') threadId: string): void {
    this.runs.cancel(threadId);
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
    const events = this.runs
      .events(threadId, after)
      .pipe(
        map(({ seq, event }) =>
          seq === undefined ? { data: event } : { id: String(seq), data: event },
        ),
      );
    // The writer can be silent for minutes, and proxies close an idle stream after about a minute.
    // A named event never reaches the client's onmessage, so it only keeps the line open.
    const ping = interval(KEEPALIVE_MS).pipe(map(() => ({ type: 'ping', data: '' })));
    return merge(events, ping);
  }
}
