import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { demoFetch, LookupCache, QlooClient, type ToolContext } from '@oraqul/engine';
import type { Output } from '@oraqul/schema';
import type { Env } from '../config/env.js';
import { LLM, type Llm } from '../llm/llm.js';
import { OutputsService } from '../outputs/outputs.service.js';
import { CATEGORY_AGENTS, placeholderAgents } from './category-agents.js';
import { FilmAgent } from './film/agent.js';
import {
  FallbackFollowUpReader,
  ModelFollowUpReader,
  ScriptedFollowUpReader,
} from './film/follow-up.js';
import { PlanSummaryPlanner } from './film/follow-ups.js';
import { FallbackQueryPlanner, ModelQueryPlanner, ScriptedQueryPlanner } from './film/planner.js';
import { FallbackFilmReader, ModelFilmReader, ScriptedFilmReader } from './film/read.js';
import {
  FallbackReportWriter,
  ModelReportWriter,
  TemplateReportWriter,
} from './film/report-writer.js';
import { FallbackResearcher, ModelResearcher, NoResearch } from './film/research.js';
import {
  FallbackResultsReader,
  ModelResultsReader,
  ScriptedResultsReader,
} from './film/results-read.js';
import { FallbackPlanWriter, ModelPlanWriter, TemplatePlanWriter } from './film/writer.js';
import { FallbackGate, GATE, ModelGate, ScriptedGate } from './gate/gate.js';
import { ModelPlanner } from './model-planner.js';
import { MusicAgent } from './music/agent.js';
import { ModelFollowUpReader as ModelMusicFollowUpReader } from './music/follow-up.js';
import {
  FallbackQueryPlanner as FallbackMusicQueryPlanner,
  ModelQueryPlanner as ModelMusicQueryPlanner,
  ScriptedQueryPlanner as ScriptedMusicQueryPlanner,
} from './music/planner.js';
import { FallbackMusicReader, ModelMusicReader, ScriptedMusicReader } from './music/read.js';
import {
  FallbackReportWriter as FallbackMusicReportWriter,
  ModelReportWriter as ModelMusicReportWriter,
  TemplateReportWriter as TemplateMusicReportWriter,
} from './music/report-writer.js';
import {
  FallbackResearcher as FallbackMusicResearcher,
  ModelResearcher as ModelMusicResearcher,
} from './music/research.js';
import {
  FallbackPlanWriter as FallbackMusicPlanWriter,
  ModelPlanWriter as ModelMusicPlanWriter,
  TemplatePlanWriter as TemplateMusicPlanWriter,
} from './music/writer.js';
import { OutputStore } from './output-store.js';
import { ModelReader } from './router/model-reader.js';
import { FallbackReader } from './router/router.js';
import { ScriptedReader } from './router/scripted-reader.js';
import { ROUTER_READER, RunService } from './run.service.js';
import { ThreadStore } from './thread-store.js';
import { createTitler, THREAD_TITLER } from './titler.js';

const logger = new Logger('Router');

// Names looked up in Qloo (comps, partner brands) are kept across runs: the next plan asks for the
// same telecoms and the same comps, and each lookup it skips is a call saved against the quota.
const lookups = new LookupCache();

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
    {
      provide: CATEGORY_AGENTS,
      inject: [LLM, ConfigService, OutputsService],
      useFactory: (llm: Llm | null, config: ConfigService<Env, true>, outputs: OutputsService) => {
        const scripted = new ScriptedFilmReader();
        const scriptedFollowUps = new ScriptedFollowUpReader();
        const followUps = llm
          ? new FallbackFollowUpReader(
              new ModelFollowUpReader(llm.model('agent'), llm.timeoutMs),
              scriptedFollowUps,
              (err) => logger.warn(`Model follow-up reader failed, using the scripted one: ${err}`),
            )
          : scriptedFollowUps;
        const reader = llm
          ? new FallbackFilmReader(
              new ModelFilmReader(llm.model('agent'), llm.timeoutMs),
              scripted,
              (err) => logger.warn(`Model reader failed, reading with the scripted reader: ${err}`),
            )
          : scripted;
        const queries = llm
          ? new FallbackQueryPlanner(
              new ModelQueryPlanner(llm.model('agent'), llm.timeoutMs),
              new ScriptedQueryPlanner(),
              (err) => logger.warn(`Model query planner failed, using the defaults: ${err}`),
            )
          : new ScriptedQueryPlanner();
        const writer = llm
          ? new FallbackPlanWriter(
              new ModelPlanWriter(llm.model('writer'), llm.writerTimeoutMs, llm.writerOptions),
              new TemplatePlanWriter(),
              (err) => logger.warn(`Model writer failed, writing from templates: ${err}`),
            )
          : new TemplatePlanWriter();
        const scriptedResults = new ScriptedResultsReader();
        const results = llm
          ? new FallbackResultsReader(
              new ModelResultsReader(llm.model('agent'), llm.timeoutMs),
              scriptedResults,
              (err) => logger.warn(`Model results reader failed, using the scripted one: ${err}`),
            )
          : scriptedResults;
        const report = llm
          ? new FallbackReportWriter(
              new ModelReportWriter(llm.model('writer'), llm.writerTimeoutMs, llm.writerOptions),
              new TemplateReportWriter(),
              (err) => logger.warn(`Model report writer failed, writing from templates: ${err}`),
            )
          : new TemplateReportWriter();
        const search = llm?.search() ?? null;
        const research =
          llm && search
            ? new FallbackResearcher(
                new ModelResearcher(search, llm.model('agent'), llm.writerTimeoutMs),
                (err) => logger.warn(`Web research failed, writing without it: ${err}`),
              )
            : new NoResearch();
        const tools = (): ToolContext => toolContext(config);
        const planFor = (plan: Output) =>
          llm ? new ModelPlanner(llm.model('agent')) : new PlanSummaryPlanner(plan);
        const maxSteps = config.get('AGENT_MAX_STEPS', { infer: true });
        const film = new FilmAgent({
          reader,
          queries,
          writer,
          results,
          report,
          research,
          followUps,
          tools,
          plan: (id) => outputs.plan(id),
          planner: planFor,
          maxSteps,
        });

        // Music shares the tools, the results reader and the search; its readers, planner and
        // writers carry music's own prompts.
        const scriptedMusic = new ScriptedMusicReader();
        const musicFollowUps = llm
          ? new FallbackFollowUpReader(
              new ModelMusicFollowUpReader(llm.model('agent'), llm.timeoutMs),
              scriptedFollowUps,
              (err) => logger.warn(`Model follow-up reader failed, using the scripted one: ${err}`),
            )
          : scriptedFollowUps;
        const music = new MusicAgent({
          reader: llm
            ? new FallbackMusicReader(
                new ModelMusicReader(llm.model('agent'), llm.timeoutMs),
                scriptedMusic,
                (err) =>
                  logger.warn(`Model reader failed, reading with the scripted reader: ${err}`),
              )
            : scriptedMusic,
          queries: llm
            ? new FallbackMusicQueryPlanner(
                new ModelMusicQueryPlanner(llm.model('agent'), llm.timeoutMs),
                new ScriptedMusicQueryPlanner(),
                (err) => logger.warn(`Model query planner failed, using the defaults: ${err}`),
              )
            : new ScriptedMusicQueryPlanner(),
          writer: llm
            ? new FallbackMusicPlanWriter(
                new ModelMusicPlanWriter(
                  llm.model('writer'),
                  llm.writerTimeoutMs,
                  llm.writerOptions,
                ),
                new TemplateMusicPlanWriter(),
                (err) => logger.warn(`Model writer failed, writing from templates: ${err}`),
              )
            : new TemplateMusicPlanWriter(),
          results,
          report: llm
            ? new FallbackMusicReportWriter(
                new ModelMusicReportWriter(
                  llm.model('writer'),
                  llm.writerTimeoutMs,
                  llm.writerOptions,
                ),
                new TemplateMusicReportWriter(),
                (err) => logger.warn(`Model report writer failed, writing from templates: ${err}`),
              )
            : new TemplateMusicReportWriter(),
          research:
            llm && search
              ? new FallbackMusicResearcher(
                  new ModelMusicResearcher(search, llm.model('agent'), llm.writerTimeoutMs),
                  (err) => logger.warn(`Web research failed, writing without it: ${err}`),
                )
              : new NoResearch(),
          followUps: musicFollowUps,
          tools,
          plan: (id) => outputs.plan(id),
          planner: planFor,
          maxSteps,
        });
        return { ...placeholderAgents(), film, music };
      },
    },
    OutputStore,
    OutputsService,
  ],
  exports: [RunService, ThreadStore, OutputsService],
})
export class AgentModule {}

// One Qloo client per run, so the call budget and the cache are the run's (spec §3.5).
function toolContext(config: ConfigService<Env, true>): ToolContext {
  const callBudget = config.get('QLOO_CALL_BUDGET', { infer: true });
  if (config.get('QLOO_MODE', { infer: true }) === 'demo') {
    const qloo = new QlooClient({
      baseUrl: 'https://demo.invalid',
      apiKey: 'demo',
      fetch: demoFetch,
      callBudget,
    });
    return { qloo, source: 'demo', entities: new Map() };
  }
  const qloo = new QlooClient({
    baseUrl: config.get('QLOO_BASE_URL', { infer: true }),
    apiKey: config.get('QLOO_API_KEY', { infer: true }),
    timeoutMs: config.get('QLOO_TIMEOUT_MS', { infer: true }),
    callBudget,
    lookupCache: lookups,
  });
  return { qloo, source: 'qloo', entities: new Map() };
}
