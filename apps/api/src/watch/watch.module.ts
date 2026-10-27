import { Logger, Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { LLM, type Llm } from '../llm/llm.js';
import { AllowanceController } from './allowance.controller.js';
import { ModelRivalFinder, NoRivalFinder, RIVAL_FINDER } from './rival-dates.js';
import { WatchController } from './watch.controller.js';
import { WatchService } from './watch.service.js';
import { WatchChecker } from './watch-checker.js';
import { WatchScheduler } from './watch-scheduler.js';

const logger = new Logger('Watch');

@Module({
  imports: [AuthModule, AgentModule],
  controllers: [WatchController, AllowanceController],
  providers: [
    WatchService,
    WatchChecker,
    WatchScheduler,
    {
      provide: RIVAL_FINDER,
      inject: [LLM],
      useFactory: (llm: Llm | null) => {
        const search = llm?.search() ?? null;
        if (!llm || !search) {
          logger.warn('No web search is set up, so launch watches will not check rival dates');
          return new NoRivalFinder();
        }
        return new ModelRivalFinder(search, llm.model('agent'), llm.writerTimeoutMs);
      },
    },
  ],
  exports: [WatchService],
})
export class WatchModule {}
