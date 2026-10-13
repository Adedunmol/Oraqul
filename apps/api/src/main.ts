import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use(cookieParser(config.get('SESSION_SECRET', { infer: true })));
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true });

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
