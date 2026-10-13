import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CodesService } from './codes.service.js';
import { BrevoEmailSender } from './email/brevo-email-sender.js';
import { ConsoleEmailSender } from './email/console-email-sender.js';
import { EMAIL_SENDER, type EmailSender } from './email/email-sender.js';
import { GoogleService } from './google.service.js';
import { LoginLimiterService } from './login-limiter.service.js';
import { RolesGuard } from './roles.guard.js';
import { SessionGuard } from './session.guard.js';
import { SessionsService } from './sessions.service.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    CodesService,
    GoogleService,
    LoginLimiterService,
    SessionsService,
    UsersService,
    SessionGuard,
    RolesGuard,
    {
      provide: EMAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): EmailSender => {
        const apiKey = config.get('BREVO_API_KEY', { infer: true });
        return apiKey
          ? new BrevoEmailSender(apiKey, config.get('EMAIL_FROM', { infer: true }))
          : new ConsoleEmailSender();
      },
    },
  ],
  exports: [SessionGuard, RolesGuard, UsersService, EMAIL_SENDER],
})
export class AuthModule {}
