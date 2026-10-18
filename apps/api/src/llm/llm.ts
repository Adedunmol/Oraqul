import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, type LanguageModel, stepCountIs } from 'ai';

/** Settings a provider takes per call, keyed by provider. */
export type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>;

import type { Env } from '../config/env.js';

export const LLM = Symbol('LLM');

/** Which step a model call serves. Each role can run on its own model. */
export type LlmRole = 'router' | 'agent' | 'writer';

/** The configured model per role. Null when no key is set, so code falls back to scripted steps. */
export interface Llm {
  model(role: LlmRole): LanguageModel;
  timeoutMs: number;
  /** For the writer: a whole plan is a long answer. */
  writerTimeoutMs: number;
  /** Provider settings for the writer's calls, such as how hard a reasoning model thinks. */
  writerOptions: ProviderOptions;
  /**
   * Web search through the writer's provider, for release timing and market facts. Null when the
   * provider has none (OpenAI-compatible endpoints).
   */
  search(): WebSearch | null;
}

export type WebSearch = (input: {
  system: string;
  prompt: string;
  abortSignal: AbortSignal;
}) => Promise<{ text: string; sources: { title: string; url: string }[]; tokens: number }>;

type LlmEnv = Pick<
  Env,
  | 'LLM_PROVIDER'
  | 'LLM_API_KEY'
  | 'LLM_MODEL'
  | 'LLM_ROUTER_MODEL'
  | 'LLM_BASE_URL'
  | 'LLM_TIMEOUT_MS'
  | 'LLM_WRITER_PROVIDER'
  | 'LLM_WRITER_API_KEY'
  | 'LLM_WRITER_MODEL'
  | 'LLM_WRITER_BASE_URL'
  | 'LLM_WRITER_TIMEOUT_MS'
  | 'LLM_WEB_SEARCH'
  | 'LLM_WRITER_REASONING'
>;

/** Builds the model from configuration only, so changing provider or model never touches code. */
export function createLlm(env: LlmEnv): Llm | null {
  if (env.LLM_API_KEY === '') return null;
  const provider = providerFor(env);
  const models: Record<LlmRole, string> = {
    router: env.LLM_ROUTER_MODEL || env.LLM_MODEL,
    agent: env.LLM_MODEL,
    writer: env.LLM_WRITER_MODEL || env.LLM_MODEL,
  };
  // A writer on another provider never borrows the main key: it needs its own, or it is not used.
  const otherProvider =
    env.LLM_WRITER_PROVIDER !== undefined && env.LLM_WRITER_PROVIDER !== env.LLM_PROVIDER;
  const own =
    (env.LLM_WRITER_MODEL !== '' || env.LLM_WRITER_API_KEY !== '') &&
    (!otherProvider || env.LLM_WRITER_API_KEY !== '');
  const writerEnv = {
    LLM_PROVIDER: own ? (env.LLM_WRITER_PROVIDER ?? env.LLM_PROVIDER) : env.LLM_PROVIDER,
    LLM_API_KEY: own ? env.LLM_WRITER_API_KEY || env.LLM_API_KEY : env.LLM_API_KEY,
    // A base url belongs to one provider, so it is not shared with another.
    LLM_BASE_URL: own
      ? env.LLM_WRITER_BASE_URL ||
        ((env.LLM_WRITER_PROVIDER ?? env.LLM_PROVIDER) === env.LLM_PROVIDER ? env.LLM_BASE_URL : '')
      : env.LLM_BASE_URL,
  };
  const writer = own ? providerFor(writerEnv) : provider;
  return {
    model: (role) => (role === 'writer' ? writer : provider)(models[role]),
    timeoutMs: env.LLM_TIMEOUT_MS,
    writerTimeoutMs: env.LLM_WRITER_TIMEOUT_MS,
    writerOptions:
      writerEnv.LLM_PROVIDER === 'openai'
        ? { openai: { reasoningEffort: env.LLM_WRITER_REASONING } }
        : {},
    search: () =>
      env.LLM_WEB_SEARCH === 'off' ? null : webSearch(writerEnv, writer(models.writer)),
  };
}

type ProviderEnv = Pick<LlmEnv, 'LLM_PROVIDER' | 'LLM_API_KEY' | 'LLM_BASE_URL'>;

async function answered(
  run: Promise<{
    text: string;
    sources: { sourceType: string; url?: string; title?: string }[];
    usage: { totalTokens?: number };
  }>,
) {
  const out = await run;
  return {
    text: out.text,
    sources: out.sources.flatMap((s) =>
      s.sourceType === 'url' && s.url ? [{ title: s.title ?? s.url, url: s.url }] : [],
    ),
    tokens: out.usage.totalTokens ?? 0,
  };
}

// The provider's own web search, run on its side. Only OpenAI and Google offer one.
function webSearch(env: ProviderEnv, model: LanguageModel): WebSearch | null {
  const apiKey = env.LLM_API_KEY;
  const baseURL = env.LLM_BASE_URL || undefined;
  switch (env.LLM_PROVIDER) {
    case 'openai': {
      const openai = createOpenAI({ apiKey, baseURL });
      return (input) =>
        answered(
          generateText({
            model,
            ...input,
            tools: { web_search: openai.tools.webSearch({}) },
            stopWhen: stepCountIs(5),
            maxRetries: 1,
          }),
        );
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey, baseURL });
      return (input) =>
        answered(
          generateText({
            model,
            ...input,
            tools: { google_search: google.tools.googleSearch({}) },
            stopWhen: stepCountIs(5),
            maxRetries: 1,
          }),
        );
    }
    case 'openai-compatible':
      return null;
  }
}

function providerFor(env: ProviderEnv): (modelId: string) => LanguageModel {
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
