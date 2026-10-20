import { Controller, Get, Header, Param } from '@nestjs/common';
import type { OutputDetail } from '@oraqul/schema';
import { SharesService } from './shares.service.js';

/** Spec §7 `GET /s/:token`. Public on purpose: the token is the access, so there is no guard. */
@Controller('s')
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex')
  shared(@Param('token') token: string): Promise<OutputDetail> {
    return this.shares.shared(token);
  }
}
