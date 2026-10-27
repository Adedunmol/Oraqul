import { Controller, Delete, Get, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentMembership } from '../auth/current-membership.decorator.js';
import { type Membership, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { CalendarService, type FeedState } from './calendar.service.js';

/** A plan's dates as a calendar file, and the project's subscribable feed (spec §7). */
@Controller()
@UseGuards(SessionGuard, RolesGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('outputs/:outputId/calendar.ics')
  @Roles('owner', 'editor', 'viewer')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="launch-calendar.ics"')
  async download(@Param('outputId') outputId: string): Promise<string> {
    return (await this.calendar.forOutput(outputId)).ics;
  }

  @Get('projects/:projectId/calendar-feed')
  @Roles('owner', 'editor', 'viewer')
  feed(@Param('projectId') projectId: string): Promise<FeedState> {
    return this.calendar.feedState(projectId);
  }

  /** The token is in this answer and nowhere else: only its hash is stored. */
  @Post('projects/:projectId/calendar-feed')
  @Roles('owner', 'editor')
  create(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<{ token: string }> {
    return this.calendar.createFeed(projectId, membership.userId);
  }

  @Delete('projects/:projectId/calendar-feed')
  @Roles('owner', 'editor')
  @HttpCode(204)
  revoke(@Param('projectId') projectId: string): Promise<void> {
    return this.calendar.revokeFeed(projectId);
  }
}

/** `GET /cal/:token`. Public on purpose: a calendar app sends no cookie, so the token is the access. */
@Controller('cal')
export class CalendarFeedController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(':token')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex')
  async feed(@Param('token') token: string): Promise<string> {
    return (await this.calendar.byToken(token)).ics;
  }
}
