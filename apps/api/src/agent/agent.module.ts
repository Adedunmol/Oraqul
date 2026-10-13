import { createOpenAI } from '@ai-sdk/openai';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { AgentController } from './agent.controller.js';
import { AgentService, PLANNER } from './agent.service.js';
import { OpenAiPlanner } from './openai-planner.js';
import { ScriptedPlanner } from './scripted-planner.js';
import { InMemoryThreadStore, ThreadStore } from './thread-store.js';

@Module({
  controllers: [AgentController],
  providers: [
    AgentService,
    { provide: ThreadStore, useClass: InMemoryThreadStore },
    {
      provide: PLANNER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get('OPENAI_API_KEY', { infer: true });
        if (apiKey === '') return new ScriptedPlanner();
        const openai = createOpenAI({ apiKey });
        return new OpenAiPlanner(openai(config.get('OPENAI_MODEL', { infer: true })));
      },
    },
  ],
})
export class AgentModule {}
