import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CodePurpose } from '@oraqul/schema';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { Env } from '../config/env.js';
import { type Database, DB } from '../db/db.module.js';
import { emailCodes } from '../db/schema.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 5;

export type PendingSignup = { name: string; passwordHash: string };
export type ConsumedCode = typeof emailCodes.$inferSelect;

@Injectable()
export class CodesService {
  private readonly secret: string;

  constructor(
    @Inject(DB) private readonly db: Database,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('SESSION_SECRET', { infer: true });
  }

  /**
   * Issues a code for an email whether or not an account exists, so the rate limit
   * and the response cannot be used to find out which emails are registered.
   */
  async issue(email: string, purpose: CodePurpose, pending?: PendingSignup): Promise<string> {
    const since = new Date(Date.now() - CODE_TTL_MS);
    const [recent] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailCodes)
      .where(
        and(
          eq(emailCodes.email, email),
          eq(emailCodes.purpose, purpose),
          gt(emailCodes.createdAt, since),
        ),
      );
    if ((recent?.count ?? 0) >= MAX_CODES_PER_WINDOW) {
      throw new HttpException(
        'Too many codes requested. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.db
      .update(emailCodes)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(emailCodes.email, email),
          eq(emailCodes.purpose, purpose),
          isNull(emailCodes.consumedAt),
        ),
      );

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.db.insert(emailCodes).values({
      email,
      purpose,
      codeHash: this.hash(email, code),
      name: pending?.name ?? null,
      passwordHash: pending?.passwordHash ?? null,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
    return code;
  }

  /** Accepts only the newest live code for the email and marks it used. Every miss counts as an attempt. */
  async consume(email: string, purposes: CodePurpose[], code: string): Promise<ConsumedCode> {
    const [row] = await this.db
      .select()
      .from(emailCodes)
      .where(
        and(
          eq(emailCodes.email, email),
          inArray(emailCodes.purpose, purposes),
          isNull(emailCodes.consumedAt),
          gt(emailCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(emailCodes.createdAt))
      .limit(1);
    if (!row) {
      throw new BadRequestException('That code is invalid or has expired');
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many attempts. Ask for a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.matches(row.codeHash, this.hash(email, code))) {
      await this.db
        .update(emailCodes)
        .set({ attempts: sql`${emailCodes.attempts} + 1` })
        .where(eq(emailCodes.id, row.id));
      throw new BadRequestException('That code is invalid or has expired');
    }

    // The conditional update makes the code single use even if two requests race.
    const [used] = await this.db
      .update(emailCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(emailCodes.id, row.id), isNull(emailCodes.consumedAt)))
      .returning();
    if (!used) {
      throw new BadRequestException('That code is invalid or has expired');
    }
    return used;
  }

  private hash(email: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${email}:${code}`).digest('hex');
  }

  private matches(stored: string, candidate: string): boolean {
    return timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(candidate, 'hex'));
  }
}
