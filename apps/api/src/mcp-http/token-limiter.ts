import { Injectable } from '@nestjs/common';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const CALLS_PER_MINUTE = 60;
export const RUNS_PER_HOUR = 10;

/**
 * Per token rate limits for the hosted MCP server: calls a minute and runs started an hour. Kept in
 * memory, which is enough because the API runs as one instance; a restart only gives a token a fresh
 * window. A limit is about protecting the server, not a security boundary: the run cap and the
 * Qloo budget are what bound spend.
 */
@Injectable()
export class TokenLimiter {
  private readonly seen = new Map<string, number[]>();

  /** True and counted when the token has room; false when it is over the limit. */
  take(tokenId: string, kind: 'call' | 'run', now: number = Date.now()): boolean {
    const [limit, window] = kind === 'call' ? [CALLS_PER_MINUTE, MINUTE] : [RUNS_PER_HOUR, HOUR];
    const key = `${kind}:${tokenId}`;
    const recent = (this.seen.get(key) ?? []).filter((t) => now - t < window);
    if (recent.length >= limit) {
      this.seen.set(key, recent);
      return false;
    }
    recent.push(now);
    this.seen.set(key, recent);
    return true;
  }
}
