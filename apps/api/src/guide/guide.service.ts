import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { GuideAnswer, GuideAsk } from '@oraqul/schema';
import { GUIDE_BOT, type GuideBot } from './guide-bot.js';
import { GuideLimiterService } from './guide-limiter.service.js';

@Injectable()
export class GuideService {
  private readonly log = new Logger(GuideService.name);

  constructor(
    private readonly limiter: GuideLimiterService,
    @Inject(GUIDE_BOT) private readonly bot: GuideBot | null,
  ) {}

  async ask(input: GuideAsk, ip: string): Promise<GuideAnswer> {
    if (!this.bot) {
      throw new HttpException('The guide assistant is not set up.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    await this.limiter.admit(ip);
    try {
      return await this.bot.ask(input);
    } catch (error) {
      this.log.warn(`Guide bot failed: ${error instanceof Error ? error.message : String(error)}`);
      await this.limiter.refund(ip);
      throw new HttpException(
        'The guide assistant could not answer just now.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
