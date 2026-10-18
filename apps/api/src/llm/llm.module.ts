import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { createLlm, LLM } from './llm.js';

@Global()
@Module({
  providers: [
    {
      provide: LLM,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createLlm({
          LLM_PROVIDER: config.get('LLM_PROVIDER', { infer: true }),
          LLM_API_KEY: config.get('LLM_API_KEY', { infer: true }),
          LLM_MODEL: config.get('LLM_MODEL', { infer: true }),
          LLM_ROUTER_MODEL: config.get('LLM_ROUTER_MODEL', { infer: true }),
          LLM_BASE_URL: config.get('LLM_BASE_URL', { infer: true }),
          LLM_TIMEOUT_MS: config.get('LLM_TIMEOUT_MS', { infer: true }),
          LLM_WRITER_PROVIDER: config.get('LLM_WRITER_PROVIDER', { infer: true }),
          LLM_WRITER_API_KEY: config.get('LLM_WRITER_API_KEY', { infer: true }),
          LLM_WRITER_MODEL: config.get('LLM_WRITER_MODEL', { infer: true }),
          LLM_WRITER_BASE_URL: config.get('LLM_WRITER_BASE_URL', { infer: true }),
          LLM_WRITER_TIMEOUT_MS: config.get('LLM_WRITER_TIMEOUT_MS', { infer: true }),
          LLM_WEB_SEARCH: config.get('LLM_WEB_SEARCH', { infer: true }),
          LLM_WRITER_REASONING: config.get('LLM_WRITER_REASONING', { infer: true }),
        }),
    },
  ],
  exports: [LLM],
})
export class LlmModule {}
