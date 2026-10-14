import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nextPathSchema } from '@oraqul/schema';
import type { Request, Response } from 'express';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import type { Env } from '../config/env.js';
import { SessionsService } from './sessions.service.js';
import { UsersService } from './users.service.js';

const OAUTH_COOKIE = 'oraqul_oauth';
const OAUTH_TTL_MS = 10 * 60 * 1000;
const DEFAULT_NEXT = '/projects';

const oauthCookieSchema = z.object({
  state: z.string(),
  verifier: z.string(),
  next: nextPathSchema,
});

const idTokenSchema = z.object({
  sub: z.string(),
  email: z.email(),
  email_verified: z.literal(true),
  name: z.string().optional(),
});

export const googleCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
});
export type GoogleCallbackQuery = z.infer<typeof googleCallbackQuerySchema>;

@Injectable()
export class GoogleService {
  private readonly client: OAuth2Client | undefined;
  private readonly webOrigin: string;
  private readonly secure: boolean;
  private readonly clientId: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {
    this.clientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
    const apiOrigin = config.get('API_ORIGIN', { infer: true });
    this.secure = apiOrigin.startsWith('https://');
    this.client = this.clientId
      ? new OAuth2Client({
          clientId: this.clientId,
          clientSecret: config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
          redirectUri: `${apiOrigin}/auth/google/callback`,
        })
      : undefined;
  }

  /** Returns the Google consent URL, or the web error URL when Google sign in is not configured. */
  async start(next: string | undefined, response: Response): Promise<string> {
    if (!this.client) {
      return this.failureUrl();
    }
    const { codeVerifier, codeChallenge } = await this.client.generateCodeVerifierAsync();
    const state = randomBytes(24).toString('hex');
    const cookie: z.infer<typeof oauthCookieSchema> = {
      state,
      verifier: codeVerifier,
      next: next ?? DEFAULT_NEXT,
    };
    response.cookie(OAUTH_COOKIE, JSON.stringify(cookie), {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secure,
      signed: true,
      path: '/auth/google',
      maxAge: OAUTH_TTL_MS,
    });
    return this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    });
  }

  /** Signs the person in and returns where to send them. Any failure sends them back to `/` with an error. */
  async finish(request: Request, response: Response, query: GoogleCallbackQuery): Promise<string> {
    response.clearCookie(OAUTH_COOKIE, { path: '/auth/google' });
    const saved = oauthCookieSchema.safeParse(this.readCookie(request));
    if (!this.client || !saved.success || !query.code || query.state !== saved.data.state) {
      return this.failureUrl();
    }

    try {
      const { tokens } = await this.client.getToken({
        code: query.code,
        codeVerifier: saved.data.verifier,
      });
      if (!tokens.id_token) {
        return this.failureUrl();
      }
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.clientId,
      });
      const profile = idTokenSchema.safeParse(ticket.getPayload());
      if (!profile.success) {
        return this.failureUrl();
      }

      const { sub, email, name } = profile.data;
      const user = await this.users.findOrLinkOAuth(
        'google',
        sub,
        email.toLowerCase(),
        name ?? email,
      );
      await this.sessions.create(user.id, response);
      return `${this.webOrigin}${saved.data.next}`;
    } catch {
      // Google rejects reused or expired codes with an error that the person cannot act on.
      return this.failureUrl();
    }
  }

  private readCookie(request: Request): unknown {
    const raw: unknown = request.signedCookies?.[OAUTH_COOKIE];
    if (typeof raw !== 'string') {
      return undefined;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  private failureUrl(): string {
    return `${this.webOrigin}/sign-in?error=google`;
  }
}
