import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import {
  codeRequestSchema,
  codeVerifySchema,
  type LoginInput,
  loginSchema,
  type MeResponse,
  nextPathSchema,
  resetConfirmSchema,
  resetRequestSchema,
  type SignupInput,
  signupSchema,
} from '@oraqul/schema';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { ZodPipe } from '../validation/zod.pipe.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  type GoogleCallbackQuery,
  GoogleService,
  googleCallbackQuerySchema,
} from './google.service.js';
import { SESSION_COOKIE, SessionGuard, type SessionUser } from './session.guard.js';
import { SessionsService } from './sessions.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleService,
    private readonly sessions: SessionsService,
  ) {}

  @Post('signup')
  @HttpCode(201)
  signup(
    @Body(new ZodPipe(signupSchema)) body: SignupInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeResponse> {
    return this.auth.signup(body, response);
  }

  @Post('verification')
  @HttpCode(202)
  @UseGuards(SessionGuard)
  resendVerification(@CurrentUser() user: SessionUser): Promise<void> {
    return this.auth.resendVerification(user);
  }

  @Post('code')
  @HttpCode(202)
  requestCode(
    @Body(new ZodPipe(codeRequestSchema)) body: z.infer<typeof codeRequestSchema>,
  ): Promise<void> {
    return this.auth.requestCode(body.email);
  }

  @Post('code/verify')
  @HttpCode(200)
  verifyCode(
    @Body(new ZodPipe(codeVerifySchema)) body: z.infer<typeof codeVerifySchema>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeResponse> {
    return this.auth.verifyCode(body.email, body.code, response);
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeResponse> {
    // request.ip is only missing on a destroyed socket, where the limit has nobody to key on.
    return this.auth.login(body, request.ip ?? 'unknown', response);
  }

  @Post('password/reset')
  @HttpCode(202)
  requestReset(
    @Body(new ZodPipe(resetRequestSchema)) body: z.infer<typeof resetRequestSchema>,
  ): Promise<void> {
    return this.auth.requestReset(body.email);
  }

  @Post('password/reset/confirm')
  @HttpCode(200)
  confirmReset(
    @Body(new ZodPipe(resetConfirmSchema)) body: z.infer<typeof resetConfirmSchema>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeResponse> {
    return this.auth.confirmReset(body.email, body.code, body.password, response);
  }

  @Get('google')
  async startGoogle(
    @Query('next', new ZodPipe(nextPathSchema.optional())) next: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(await this.google.start(next, response));
  }

  @Get('google/callback')
  async finishGoogle(
    @Query(new ZodPipe(googleCallbackQuerySchema)) query: GoogleCallbackQuery,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(await this.google.finish(request, response, query));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    return this.sessions.destroy(request.signedCookies?.[SESSION_COOKIE], response);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: SessionUser): MeResponse {
    return AuthService.me(user);
  }
}
