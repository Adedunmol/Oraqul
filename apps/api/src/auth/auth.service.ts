import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { LoginInput, MeResponse, SignupInput } from '@oraqul/schema';
import type { Response } from 'express';
import { CodesService } from './codes.service.js';
import { EMAIL_SENDER, type EmailSender } from './email/email-sender.js';
import { codeEmail } from './email/templates.js';
import { LoginLimiterService } from './login-limiter.service.js';
import { hashPassword, verifyPassword } from './password.js';
import type { SessionUser } from './session.guard.js';
import { SessionsService } from './sessions.service.js';
import { UsersService } from './users.service.js';

@Injectable()
export class AuthService {
  // Compared against when the email is unknown, so a miss takes as long as a wrong password.
  private readonly missHash = hashPassword(randomBytes(16).toString('hex'));

  constructor(
    private readonly codes: CodesService,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly loginLimiter: LoginLimiterService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  static me(user: SessionUser): MeResponse {
    return { user: { id: user.id, email: user.email, name: user.name } };
  }

  async signup(input: SignupInput): Promise<void> {
    const code = await this.codes.issue(input.email, 'signup', {
      name: input.name,
      passwordHash: await hashPassword(input.password),
    });
    await this.email.send(codeEmail(input.email, 'signup', code));
  }

  async requestCode(email: string): Promise<void> {
    const code = await this.codes.issue(email, 'signin');
    await this.email.send(codeEmail(email, 'signin', code));
  }

  async verifyCode(email: string, code: string, response: Response): Promise<MeResponse> {
    const used = await this.codes.consume(email, ['signin', 'signup'], code);
    const user = await this.users.findOrCreateVerified(
      email,
      used.name ?? email.split('@')[0] ?? email,
    );
    if (used.purpose === 'signup' && used.passwordHash) {
      await this.users.setPasswordIfMissing(user.id, used.passwordHash);
    }
    await this.sessions.create(user.id, response);
    return AuthService.me(user);
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
