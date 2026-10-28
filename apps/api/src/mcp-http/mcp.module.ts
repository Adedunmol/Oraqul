import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { WatchModule } from '../watch/watch.module.js';
import { McpController } from './mcp.controller.js';
import { McpService } from './mcp.service.js';
import { TokenGuard } from './token.guard.js';
import { TokenLimiter } from './token-limiter.js';
import { TokensController } from './tokens.controller.js';
import { TokensService } from './tokens.service.js';

@Module({
  imports: [AuthModule, AgentModule, ProjectsModule, WatchModule],
  controllers: [McpController, TokensController],
  providers: [McpService, TokensService, TokenLimiter, TokenGuard],
})
export class McpModule {}
