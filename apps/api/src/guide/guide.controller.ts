import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { type GuideAnswer, type GuideAsk, guideAskSchema } from '@oraqul/schema';
import type { Request } from 'express';
import { ZodPipe } from '../validation/zod.pipe.js';
import { GuideService } from './guide.service.js';

/**
 * Spec §7 `POST /guide/ask`. Public on purpose, like the Guide it serves: it holds no team data,
 * reads only the Guide's own text and sends nothing a visitor typed anywhere but the model.
 */
@Controller('guide')
export class GuideController {
  constructor(private readonly guide: GuideService) {}

  @Post('ask')
  @HttpCode(200)
  ask(
    @Body(new ZodPipe(guideAskSchema)) body: GuideAsk,
    @Req() request: Request,
  ): Promise<GuideAnswer> {
    // request.ip is only missing on a destroyed socket, where the limit has nobody to key on.
    return this.guide.ask(body, request.ip ?? 'unknown');
  }
}
