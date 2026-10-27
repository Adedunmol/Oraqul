import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LoginInput, MeResponse, SignupInput } from '@oraqul/schema';
import type { Response } from 'express';
import type { Env } from '../config/env.js';
import { CodesService } from './codes.service.js';
import { EMAIL_SENDER, type EmailSender } from './email/email-sender.js';
import { codeEmail, verifyEmail } from './email/templates.js';
import { LoginLimiterService } from './login-limiter.service.js';
import { hashPassword, verifyPassword } from './password.js';
import type { SessionUser } from './session.guard.js';
import { SessionsService } from './sessions.service.js';
import { UsersService } from './users.service.js';

@Injectable()
export class AuthService {
  // Compared against when the email is unknown, so a miss takes as long as a wrong password.
  private readonly missHash = hashPassword(randomBytes(16).toString('hex'));

  private readonly logger = new Logger(AuthService.name);
  private readonly webOrigin: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly codes: CodesService,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly loginLimiter: LoginLimiterService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  static me(user: SessionUser): MeResponse {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerifiedAt !== null,
      },
    };
  }

  /**
   * Signs the person in at once so they can look around while the confirmation email is on its
   * way. A failed send does not undo the account: they can ask for another from the app.
   */
  async signup(input: SignupInput, response: Response): Promise<MeResponse> {
    const user = await this.users.createUnverified(
      input.email,
      input.name,
      await hashPassword(input.password),
    );
    await this.sessions.create(user.id, response);
    try {
      await this.sendVerification(user.email);
    } catch (error) {
      this.logger.warn(`Verification email to ${user.email} was not sent: ${String(error)}`);
    }
    return AuthService.me(user);
  }

  /** Does nothing for an account that is already confirmed, so a double click is harmless. */
  async resendVerification(user: SessionUser): Promise<void> {
    if (user.emailVerifiedAt) return;
    await this.sendVerification(user.email);
  }

  private async sendVerification(email: string): Promise<void> {
    const code = await this.codes.issue(email, 'verify');
    const link = new URL('/verify', this.webOrigin);
    link.searchParams.set('email', email);
    link.searchParams.set('code', code);
    await this.email.send(verifyEmail(email, code, link.toString()));
  }

  async requestCode(email: string): Promise<void> {
    const code = await this.codes.issue(email, 'signin');
    await this.email.send(codeEmail(email, 'signin', code));
  }

  async verifyCode(email: string, code: string, response: Response): Promise<MeResponse> {
    const used = await this.codes.consume(email, ['signin', 'verify'], code);
    const user =
      used.purpose === 'verify'
        ? await this.confirmSignup(email)
        : await this.users.findOrCreateVerified(email, email.split('@')[0] ?? email);
    await this.sessions.create(user.id, response);
    return AuthService.me(user);
  }

  private async confirmSignup(email: string) {
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new BadRequestException('That code is invalid or has expired');
    }
    return this.users.confirmSignupEmail(user);
  }

  async login(input: LoginInput, ip: string, response: Response): Promise<MeResponse> {
    await this.loginLimiter.assertAllowed(input.email, ip);
    const user = await this.users.findByEmail(input.email);
    const stored = user?.passwordHash ?? (await this.missHash);
    const matches = await verifyPassword(input.password, stored);
    if (!user?.passwordHash || !matches) {
      await this.loginLimiter.recordFailure(input.email, ip);
      throw new UnauthorizedException('Wrong email or password');
    }
    await this.loginLimiter.clear(input.email, ip);
    await this.sessions.create(user.id, response);
    return AuthService.me(user);
  }

  async requestReset(email: string): Promise<void> {
    const code = await this.codes.issue(email, 'reset');
    const user = await this.users.findByEmail(email);
    if (user) {
      await this.email.send(codeEmail(email, 'reset', code));
    }
  }

  async confirmReset(
    email: string,
    code: string,
    password: string,
    response: Response,
  ): Promise<MeResponse> {
    await this.codes.consume(email, ['reset'], code);
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new BadRequestException('That code is invalid or has expired');
    }
    await this.users.setPassword(user.id, await hashPassword(password));
    await this.sessions.destroyAllForUser(user.id);
    await this.sessions.create(user.id, response);
    return AuthService.me(user);
  }
}
