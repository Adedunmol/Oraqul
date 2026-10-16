import { Logger, Module } from '@nestjs/common';
import { LLM, type Llm } from '../llm/llm.js';
import { CATEGORY_AGENTS, placeholderAgents } from './category-agents.js';
import { FallbackGate, GATE, ModelGate, ScriptedGate } from './gate/gate.js';
import { ModelReader } from './router/model-reader.js';
import { FallbackReader } from './router/router.js';
import { ScriptedReader } from './router/scripted-reader.js';
import { ROUTER_READER, RunService } from './run.service.js';
import { ThreadStore } from './thread-store.js';
import { createTitler, THREAD_TITLER } from './titler.js';

const logger = new Logger('Router');

@Module({
  providers: [
    ThreadStore,
    RunService,
    {
      provide: ROUTER_READER,
      inject: [LLM],
      useFactory: (llm: Llm | null) => {
        const scripted = new ScriptedReader();
        if (!llm) return scripted;
        return new FallbackReader(
          new ModelReader(llm.model('router'), llm.timeoutMs),
          scripted,
          (err) => logger.warn(`Model router failed, reading with the scripted router: ${err}`),
        );
      },
    },
    {
      provide: GATE,
      inject: [LLM],
      useFactory: (llm: Llm | null) => {
        const scripted = new ScriptedGate();
        if (!llm) return scripted;
        return new FallbackGate(
          new ModelGate(llm.model('router'), llm.timeoutMs),
          scripted,
          (err) => logger.warn(`Model gate failed, letting the message through: ${err}`),
        );
      },
    },
    {
      provide: THREAD_TITLER,
      inject: [LLM],
      useFactory: (llm: Llm | null) =>
        createTitler(llm, (err) =>
          logger.warn(`Model titler failed, naming the chat the scripted way: ${err}`),
        ),
    },
    { provide: CATEGORY_AGENTS, useFactory: placeholderAgents },
  ],
  exports: [RunService, ThreadStore],
})
export class AgentModule {}
