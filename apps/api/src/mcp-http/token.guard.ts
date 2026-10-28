import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokenLimiter } from './token-limiter.js';
import { type Principal, TokensService } from './tokens.service.js';

export type McpRequest = Request & { principal: Principal };

/**
 * Authenticates a call to the hosted MCP server by its personal access token, on every call. A wrong,
 * revoked or expired token gets the same 401, and a token over its rate limit gets a 429.
 */
@Injectable()
export class TokenGuard implements CanActivate {
  constructor(
    @Inject(TokensService) private readonly tokens: TokensService,
    @Inject(TokenLimiter) private readonly limiter: TokenLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<McpRequest>();
    const match = request.headers.authorization?.match(/^Bearer\s+(oraq_[A-Za-z0-9_-]{20,})$/);
    const principal = match?.[1] ? await this.tokens.authenticate(match[1]) : null;
    if (!principal) throw new UnauthorizedException('A valid Oraqul token is needed');
    if (!this.limiter.take(principal.tokenId, 'call')) {
      throw new HttpException('Too many calls. Wait a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }
    request.principal = principal;
    return true;
  }
}
