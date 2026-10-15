import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PinsController } from './pins.controller.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [AuthModule, AgentModule],
  controllers: [ProjectsController, PinsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
