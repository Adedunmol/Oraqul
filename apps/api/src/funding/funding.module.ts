import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LLM, type Llm } from '../llm/llm.js';
import { TeamRulesModule } from '../team-rules/team-rules.module.js';
import {
  FUNDING_RESEARCHER,
  type FundingResearcher,
  ModelFundingResearcher,
  NoFundingResearch,
} from './fund-research.js';
import { FundingController } from './funding.controller.js';
import { FundingService } from './funding.service.js';

@Module({
  imports: [AuthModule, TeamRulesModule],
  controllers: [FundingController],
  providers: [
    FundingService,
    {
      provide: FUNDING_RESEARCHER,
      inject: [LLM],
      useFactory: (llm: Llm | null): FundingResearcher => {
        const search = llm?.search() ?? null;
        if (!llm || !search) return new NoFundingResearch();
        return new ModelFundingResearcher(search, llm.model('agent'), llm.writerTimeoutMs);
      },
    },
  ],
  exports: [FundingService, FUNDING_RESEARCHER],
})
export class FundingModule {}
