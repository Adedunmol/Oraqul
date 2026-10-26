import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { GuideController } from './guide.controller.js';
import { GuideService } from './guide.service.js';
import { GUIDE_BOT, ModelGuideBot } from './guide-bot.js';
import { GuideLimiterService } from './guide-limiter.service.js';

@Module({
  controllers: [GuideController],
  providers: [
    GuideLimiterService,
    GuideService,
    {
      provide: GUIDE_BOT,
      inject: [ConfigService],
      // No key, no bot: the endpoint then answers 503 and the Guide pages stand on their own.
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get('GUIDE_BOT_API_KEY', { infer: true });
        if (apiKey === '') return null;
        const google = createGoogleGenerativeAI({ apiKey });
        return new ModelGuideBot(google(config.get('GUIDE_BOT_MODEL', { infer: true })), 20_000);
      },
    },
  ],
})
export class GuideModule {}
