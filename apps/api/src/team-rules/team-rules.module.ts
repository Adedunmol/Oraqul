import { Logger, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LLM, type Llm } from '../llm/llm.js';
import {
  FallbackRuleExtractor,
  ModelRuleExtractor,
  RULE_EXTRACTOR,
  ScriptedRuleExtractor,
} from './extract.js';
import { TeamRulesController } from './team-rules.controller.js';
import { TeamRulesService } from './team-rules.service.js';

const logger = new Logger('TeamRules');

@Module({
  imports: [AuthModule],
  controllers: [TeamRulesController],
  providers: [
    TeamRulesService,
    {
      provide: RULE_EXTRACTOR,
      inject: [LLM],
      useFactory: (llm: Llm | null) => {
        const scripted = new ScriptedRuleExtractor();
        if (!llm) return scripted;
        return new FallbackRuleExtractor(
          new ModelRuleExtractor(llm.model('agent'), llm.timeoutMs),
          scripted,
          (err) => logger.warn(`Model rule extraction failed, reading the templates: ${err}`),
        );
      },
    },
  ],
  exports: [TeamRulesService],
})
export class TeamRulesModule {}
