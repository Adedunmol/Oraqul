import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { Env } from '../config/env.js';

export const LLM = Symbol('LLM');

/** Which step a model call serves. Each role can run on its own model. */
export type LlmRole = 'router' | 'agent';

/** The configured model per role. Null when no key is set, so code falls back to scripted steps. */
export interface Llm {
  model(role: LlmRole): LanguageModel;
  timeoutMs: number;
}

type LlmEnv = Pick<
  Env,
  | 'LLM_PROVIDER'
  | 'LLM_API_KEY'
  | 'LLM_MODEL'
  | 'LLM_ROUTER_MODEL'
  | 'LLM_BASE_URL'
  | 'LLM_TIMEOUT_MS'
>;

/** Builds the model from configuration only, so changing provider or model never touches code. */
export function createLlm(env: LlmEnv): Llm | null {
  if (env.LLM_API_KEY === '') return null;
  const provider = providerFor(env);
  const models: Record<LlmRole, string> = {
    router: env.LLM_ROUTER_MODEL || env.LLM_MODEL,
    agent: env.LLM_MODEL,
  };
  return { model: (role) => provider(models[role]), timeoutMs: env.LLM_TIMEOUT_MS };
}

function providerFor(env: LlmEnv): (modelId: string) => LanguageModel {
  const apiKey = env.LLM_API_KEY;
  const baseURL = env.LLM_BASE_URL || undefined;
  switch (env.LLM_PROVIDER) {
    case 'openai':
      return createOpenAI({ apiKey, baseURL });
    case 'google':
      return createGoogleGenerativeAI({ apiKey, baseURL });
    case 'openai-compatible': {
      // OpenRouter, Groq, Ollama and the like speak Chat Completions, not the Responses API that
      // the default OpenAI model uses.
      const openai = createOpenAI({ apiKey, baseURL });
      return (modelId) => openai.chat(modelId);
    }
  }
}
