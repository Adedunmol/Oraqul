import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { envSchema } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { LlmModule } from './llm/llm.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { UploadsModule } from './uploads/uploads.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: (raw) => envSchema.parse(raw),
    }),
    DbModule,
    LlmModule,
    AuthModule,
    HealthModule,
    ProjectsModule,
    UploadsModule,
    TeamsModule,
  ],
})
export class AppModule {}
