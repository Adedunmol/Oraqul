import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Behind a reverse proxy, request.ip is the proxy unless Express is told how many hops to trust.
  // Login rate limits key on it, so a wrong value either shares one limit between everyone or lets
  // a caller pick their own address with X-Forwarded-For.
  const proxyHops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (proxyHops > 0) {
    app.set('trust proxy', proxyHops);
  }
  app.use(cookieParser(config.get('SESSION_SECRET', { infer: true })));
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true });

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
