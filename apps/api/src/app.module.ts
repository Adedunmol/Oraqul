import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module.js';
import { AuthModule } from './auth/auth.module.js';
import { envSchema } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { TeamsModule } from './teams/teams.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: (raw) => envSchema.parse(raw),
    }),
    DbModule,
    AuthModule,
    HealthModule,
    AgentModule,
    TeamsModule,
  ],
})
export class AppModule {}
