import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { type AcceptInviteResponse, type InvitePreview, inviteTokenSchema } from '@oraqul/schema';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionGuard, type SessionUser } from '../auth/session.guard.js';
import { ZodPipe } from '../validation/zod.pipe.js';
import { InvitesService } from './invites.service.js';

const tokenPipe = new ZodPipe(inviteTokenSchema);

@Controller('invites')
@UseGuards(SessionGuard)
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':token')
  preview(
    @Param('token', tokenPipe) token: string,
    @CurrentUser() user: SessionUser,
  ): Promise<InvitePreview> {
    return this.invites.preview(token, user);
  }

  @Post(':token/accept')
  @HttpCode(200)
  accept(
    @Param('token', tokenPipe) token: string,
    @CurrentUser() user: SessionUser,
  ): Promise<AcceptInviteResponse> {
    return this.invites.accept(token, user);
  }
}
