import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  type Draft,
  type FundingItem,
  type FundingState,
  type ProjectFacts,
  setFactsSchema,
  type UpdateFundingItem,
  updateFundingItemSchema,
} from '@oraqul/schema';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { type Membership, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard, VerifiedGuard } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { FundingService } from './funding.service.js';

/** A plan's sponsors, funds and their pipeline (spec §7). Nothing here sends anything. */
@Controller()
@UseGuards(SessionGuard, RolesGuard)
export class FundingController {
  constructor(private readonly funding: FundingService) {}

  @Get('outputs/:outputId/funding')
  @Roles('owner', 'editor', 'viewer')
  state(@Param('outputId') outputId: string): Promise<FundingState> {
    return this.funding.state(outputId);
  }

  @Put('projects/:projectId/facts')
  @Roles('owner', 'editor')
  facts(
    @Param('projectId') projectId: string,
    @Body(new ZodPipe(setFactsSchema)) body: ProjectFacts,
  ): Promise<ProjectFacts> {
    return this.funding.setFacts(projectId, body);
  }

  @Patch('outputs/:outputId/funding/items/:itemId')
  @Roles('owner', 'editor')
  update(
    @Param('outputId') outputId: string,
    @Param('itemId') itemId: string,
    @Body(new ZodPipe(updateFundingItemSchema)) body: UpdateFundingItem,
  ): Promise<FundingItem> {
    return this.funding.update(outputId, itemId, body);
  }

  @Post('outputs/:outputId/funding/items/:itemId/draft')
  @Roles('owner', 'editor')
  @HttpCode(200)
  draft(
    @Param('outputId') outputId: string,
    @Param('itemId') itemId: string,
  ): Promise<{ item: FundingItem; draft: Draft }> {
    return this.funding.draft(outputId, itemId);
  }

  /** Approves the draft and returns its text for the person to open in their own app. */
  @Post('outputs/:outputId/funding/items/:itemId/handoff')
  @Roles('owner', 'editor')
  @UseGuards(VerifiedGuard)
  @HttpCode(200)
  async handoff(
    @Param('outputId') outputId: string,
    @Param('itemId') itemId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<{ item: FundingItem; draft: Draft }> {
    const { projectId } = await this.funding.projectOf(outputId);
    return this.funding.handoff(outputId, itemId, {
      teamId: membership.teamId,
      projectId,
      role: membership.role,
    });
  }

  /** The person says they sent it from their own app. The only way an item reaches `sent_by_you`. */
  @Post('outputs/:outputId/funding/items/:itemId/sent')
  @Roles('owner', 'editor')
  @UseGuards(VerifiedGuard)
  @HttpCode(200)
  sent(@Param('outputId') outputId: string, @Param('itemId') itemId: string): Promise<FundingItem> {
    return this.funding.confirmSent(outputId, itemId);
  }
}
