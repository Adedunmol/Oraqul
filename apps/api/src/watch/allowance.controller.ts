import { Controller, Get, UseGuards } from '@nestjs/common';
import type { RunAllowance } from '@oraqul/schema';
import { RunCapsService } from '../agent/run-caps.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionGuard, type SessionUser } from '../auth/session.guard.js';

/** The caller's own run count for the month. It touches no team's data, so it needs no role. */
@Controller('me')
@UseGuards(SessionGuard)
export class AllowanceController {
  constructor(private readonly caps: RunCapsService) {}

  @Get('runs')
  runs(@CurrentUser() user: SessionUser): Promise<RunAllowance> {
    return this.caps.allowance(user.id);
  }
}
