import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  type ActualsPreview,
  actualsPreviewSchema,
  type PaceState,
  saveActualsSchema,
  type UpdateWatch,
  updatePaceSchema,
  updateWatchSchema,
  type WatchState,
} from '@oraqul/schema';
import { z } from 'zod';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { type Membership, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard, VerifiedGuard } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { PaceService } from './pace.service.js';
import { WatchService } from './watch.service.js';

const muteSchema = z.object({ muted: z.boolean() });

/** Launch Watch and the team's figures for a plan (spec §7). Reads for the team, writes for owners and editors. */
@Controller('outputs/:outputId')
@UseGuards(SessionGuard, RolesGuard)
export class WatchController {
  constructor(
    private readonly watch: WatchService,
    private readonly pace: PaceService,
  ) {}

  @Get('watch')
  @Roles('owner', 'editor', 'viewer')
  state(
    @Param('outputId') outputId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<WatchState> {
    return this.watch.state(outputId, membership.userId);
  }

  @Put('watch')
  @Roles('owner', 'editor')
  update(
    @Param('outputId') outputId: string,
    @Body(new ZodPipe(updateWatchSchema)) body: UpdateWatch,
    @CurrentMembership() membership: Membership,
  ): Promise<WatchState> {
    return this.watch.update(outputId, membership, body);
  }

  /** The person's own digest switch: any member may change their own, so a viewer can stop emails. */
  @Put('watch/mute')
  @Roles('owner', 'editor', 'viewer')
  mute(
    @Param('outputId') outputId: string,
    @Body(new ZodPipe(muteSchema)) body: z.output<typeof muteSchema>,
    @CurrentMembership() membership: Membership,
  ): Promise<WatchState> {
    return this.watch.mute(outputId, membership.userId, body.muted);
  }

  @Post('watch/read')
  @Roles('owner', 'editor', 'viewer')
  @HttpCode(204)
  read(
    @Param('outputId') outputId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<void> {
    return this.watch.markRead(outputId, membership.userId);
  }

  @Post('watch/events/:eventId/approve')
  @Roles('owner', 'editor')
  @UseGuards(VerifiedGuard)
  approve(
    @Param('outputId') outputId: string,
    @Param('eventId') eventId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<WatchState> {
    return this.watch.approve(outputId, eventId, membership.userId);
  }

  @Post('watch/events/:eventId/dismiss')
  @Roles('owner', 'editor')
  dismiss(
    @Param('outputId') outputId: string,
    @Param('eventId') eventId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<WatchState> {
    return this.watch.dismiss(outputId, eventId, membership.userId);
  }

  /** Reads pasted lines or a CSV into rows and a column mapping. Nothing is saved yet. */
  @Post('actuals/preview')
  @Roles('owner', 'editor')
  @HttpCode(200)
  preview(
    @Body(new ZodPipe(actualsPreviewSchema)) body: z.output<typeof actualsPreviewSchema>,
  ): ActualsPreview {
    return this.pace.preview(body.text, body.mapping);
  }

  @Put('actuals')
  @Roles('owner', 'editor')
  async save(
    @Param('outputId') outputId: string,
    @Body(new ZodPipe(saveActualsSchema)) body: z.output<typeof saveActualsSchema>,
    @CurrentMembership() membership: Membership,
  ): Promise<PaceState> {
    await this.pace.save(outputId, membership.userId, body.rows);
    return this.pace.state(outputId);
  }

  @Delete('actuals/:actualId')
  @Roles('owner', 'editor')
  async remove(
    @Param('outputId') outputId: string,
    @Param('actualId') actualId: string,
  ): Promise<PaceState> {
    await this.pace.remove(outputId, actualId);
    return this.pace.state(outputId);
  }

  @Put('pace')
  @Roles('owner', 'editor')
  setPace(
    @Param('outputId') outputId: string,
    @Body(new ZodPipe(updatePaceSchema)) body: z.output<typeof updatePaceSchema>,
  ): Promise<PaceState> {
    return this.pace.update(outputId, body);
  }
}
