import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { demoFetch, LookupCache, QlooClient, RequestSlots, type ToolContext } from '@oraqul/engine';
import type { Output } from '@oraqul/schema';
import type { Env } from '../config/env.js';
import { LLM, type Llm } from '../llm/llm.js';
import { OutputsService } from '../outputs/outputs.service.js';
import { BooksAgent } from './books/agent.js';
import { ModelFollowUpReader as ModelBooksFollowUpReader } from './books/follow-up.js';
import {
  FallbackQueryPlanner as FallbackBooksQueryPlanner,
  ModelQueryPlanner as ModelBooksQueryPlanner,
  ScriptedQueryPlanner as ScriptedBooksQueryPlanner,
} from './books/planner.js';
import { FallbackBooksReader, ModelBooksReader, ScriptedBooksReader } from './books/read.js';
import {
  FallbackReportWriter as FallbackBooksReportWriter,
  ModelReportWriter as ModelBooksReportWriter,
  TemplateReportWriter as TemplateBooksReportWriter,
} from './books/report-writer.js';
import {
  FallbackResearcher as FallbackBooksResearcher,
  ModelResearcher as ModelBooksResearcher,
} from './books/research.js';
import {
  FallbackPlanWriter as FallbackBooksPlanWriter,
  ModelPlanWriter as ModelBooksPlanWriter,
  TemplatePlanWriter as TemplateBooksPlanWriter,
} from './books/writer.js';
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
import { GamesAgent } from './games/agent.js';
import { ModelFollowUpReader as ModelGamesFollowUpReader } from './games/follow-up.js';
import {
  FallbackQueryPlanner as FallbackGamesQueryPlanner,
  ModelQueryPlanner as ModelGamesQueryPlanner,
  ScriptedQueryPlanner as ScriptedGamesQueryPlanner,
} from './games/planner.js';
import { FallbackGamesReader, ModelGamesReader, ScriptedGamesReader } from './games/read.js';
import {
  FallbackReportWriter as FallbackGamesReportWriter,
  ModelReportWriter as ModelGamesReportWriter,
  TemplateReportWriter as TemplateGamesReportWriter,
} from './games/report-writer.js';
import {
  FallbackResearcher as FallbackGamesResearcher,
  ModelResearcher as ModelGamesResearcher,
} from './games/research.js';
import {
  FallbackPlanWriter as FallbackGamesPlanWriter,
  ModelPlanWriter as ModelGamesPlanWriter,
  TemplatePlanWriter as TemplateGamesPlanWriter,
} from './games/writer.js';
import { FallbackGate, GATE, ModelGate, ScriptedGate } from './gate/gate.js';
import { FallbackAnalyst, ModelAnalyst, ScriptedAnalyst } from './launch/analyse.js';
import { StandalonePlanner } from './launch/follow-ups.js';
import {
  FallbackResearchPlanner,
  ModelResearchPlanner,
  ScriptedResearchPlanner,
} from './launch/research-loop.js';
import { FallbackReviewer, ModelReviewer, ScriptedReviewer } from './launch/review.js';
import { MemoryStore } from './memory/memory-store.js';
import {
  FallbackMemoryWriter,
  MEMORY_WRITER,
  ModelMemoryWriter,
  ScriptedMemoryWriter,
} from './memory/memory-writer.js';
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
import { PodcastsAgent } from './podcasts/agent.js';
import { ModelFollowUpReader as ModelPodcastsFollowUpReader } from './podcasts/follow-up.js';
import {
  FallbackQueryPlanner as FallbackPodcastsQueryPlanner,
  ModelQueryPlanner as ModelPodcastsQueryPlanner,
  ScriptedQueryPlanner as ScriptedPodcastsQueryPlanner,
} from './podcasts/planner.js';
import {
  FallbackPodcastsReader,
  ModelPodcastsReader,
  ScriptedPodcastsReader,
} from './podcasts/read.js';
import {
  FallbackReportWriter as FallbackPodcastsReportWriter,
  ModelReportWriter as ModelPodcastsReportWriter,
  TemplateReportWriter as TemplatePodcastsReportWriter,
} from './podcasts/report-writer.js';
import {
  FallbackResearcher as FallbackPodcastsResearcher,
  ModelResearcher as ModelPodcastsResearcher,
} from './podcasts/research.js';
import {
  FallbackPlanWriter as FallbackPodcastsPlanWriter,
  ModelPlanWriter as ModelPodcastsPlanWriter,
  TemplatePlanWriter as TemplatePodcastsPlanWriter,
} from './podcasts/writer.js';
import { ModelReader } from './router/model-reader.js';
import { FallbackReader } from './router/router.js';
import { ScriptedReader } from './router/scripted-reader.js';
import { ROUTER_READER, RunService } from './run.service.js';
import { ShowsAgent } from './shows/agent.js';
import { ModelFollowUpReader as ModelShowsFollowUpReader } from './shows/follow-up.js';
import {
  FallbackQueryPlanner as FallbackShowsQueryPlanner,
  ModelQueryPlanner as ModelShowsQueryPlanner,
  ScriptedQueryPlanner as ScriptedShowsQueryPlanner,
} from './shows/planner.js';
import { FallbackShowsReader, ModelShowsReader, ScriptedShowsReader } from './shows/read.js';
import {
  FallbackReportWriter as FallbackShowsReportWriter,
  ModelReportWriter as ModelShowsReportWriter,
  TemplateReportWriter as TemplateShowsReportWriter,
} from './shows/report-writer.js';
import {
  FallbackResearcher as FallbackShowsResearcher,
  ModelResearcher as ModelShowsResearcher,
} from './shows/research.js';
import {
  FallbackPlanWriter as FallbackShowsPlanWriter,
  ModelPlanWriter as ModelShowsPlanWriter,
  TemplatePlanWriter as TemplateShowsPlanWriter,
} from './shows/writer.js';
import {
  CHAT_SUMMARIZER,
  FallbackChatSummarizer,
  ModelChatSummarizer,
  ScriptedChatSummarizer,
} from './summary/chat-summarizer.js';
import { ThreadStore } from './thread-store.js';
import { createTitler, THREAD_TITLER } from './titler.js';
import { VERSIONS, versionsOf } from './versions.js';

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
        const slots = new RequestSlots(config.get('QLOO_MAX_CONCURRENT', { infer: true }));
        const tools = (): ToolContext => toolContext(config, slots);
        const planFor = (plan: Output) =>
          llm ? new ModelPlanner(llm.model('agent'), llm.timeoutMs) : new PlanSummaryPlanner(plan);
        const maxSteps = config.get('AGENT_MAX_STEPS', { infer: true });
        // One analyst for every category: it reads the request, not the category's fields.
        const analyst = llm
          ? new FallbackAnalyst(
              new ModelAnalyst(llm.model('agent'), llm.timeoutMs),
              new ScriptedAnalyst(),
              (err) => logger.warn(`Model analyst failed, reading without inference: ${err}`),
            )
          : new ScriptedAnalyst();
        const researchPlanner = llm
          ? new FallbackResearchPlanner(
              new ModelResearchPlanner(llm.model('agent'), llm.timeoutMs),
              new ScriptedResearchPlanner(),
              (err) =>
                logger.warn(`Model research check failed, skipping the second round: ${err}`),
            )
          : new ScriptedResearchPlanner();
        const standalone = llm
          ? new ModelPlanner(llm.model('agent'), llm.timeoutMs)
          : new StandalonePlanner();
        const reviewer = llm
          ? new FallbackReviewer(
              new ModelReviewer(llm.model('writer'), llm.writerTimeoutMs),
              new ScriptedReviewer(),
              (err) => logger.warn(`Model red team failed, saving without a review: ${err}`),
            )
          : new ScriptedReviewer();
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
          analyst,
          researchPlanner,
          reviewer,
          standalone,
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
          analyst,
          researchPlanner,
          reviewer,
          standalone,
        });

        // Live shows shares the tools, the results reader and the search; its readers, planner and
        // writers carry the live shows prompts.
        const scriptedShows = new ScriptedShowsReader();
        const showsFollowUps = llm
          ? new FallbackFollowUpReader(
              new ModelShowsFollowUpReader(llm.model('agent'), llm.timeoutMs),
              scriptedFollowUps,
              (err) => logger.warn(`Model follow-up reader failed, using the scripted one: ${err}`),
            )
          : scriptedFollowUps;
        const shows = new ShowsAgent({
          reader: llm
            ? new FallbackShowsReader(
                new ModelShowsReader(llm.model('agent'), llm.timeoutMs),
                scriptedShows,
                (err) =>
                  logger.warn(`Model reader failed, reading with the scripted reader: ${err}`),
              )
            : scriptedShows,
          queries: llm
            ? new FallbackShowsQueryPlanner(
                new ModelShowsQueryPlanner(llm.model('agent'), llm.timeoutMs),
                new ScriptedShowsQueryPlanner(),
                (err) => logger.warn(`Model query planner failed, using the defaults: ${err}`),
              )
            : new ScriptedShowsQueryPlanner(),
          writer: llm
            ? new FallbackShowsPlanWriter(
                new ModelShowsPlanWriter(
                  llm.model('writer'),
                  llm.writerTimeoutMs,
                  llm.writerOptions,
                ),
                new TemplateShowsPlanWriter(),
                (err) => logger.warn(`Model writer failed, writing from templates: ${err}`),
              )
            : new TemplateShowsPlanWriter(),
          results,
          report: llm
            ? new FallbackShowsReportWriter(
                new ModelShowsReportWriter(
                  llm.model('writer'),
                  llm.writerTimeoutMs,
                  llm.writerOptions,
                ),
                new TemplateShowsReportWriter(),
                (err) => logger.warn(`Model report writer failed, writing from templates: ${err}`),
              )
            : new TemplateShowsReportWriter(),
          research:
            llm && search
              ? new FallbackShowsResearcher(
                  new ModelShowsResearcher(search, llm.model('agent'), llm.writerTimeoutMs),
                  (err) => logger.warn(`Web research failed, writing without it: ${err}`),
                )
              : new NoResearch(),
          followUps: showsFollowUps,
          tools,
          plan: (id) => outputs.plan(id),
          planner: planFor,
          maxSteps,
          analyst,
          researchPlanner,
          reviewer,
          standalone,
        });

        // Games shares the tools, the results reader and the search; its readers, planner and
        // writers carry the games prompts. Its scripted follow-up reader also reads a collab.
        const scriptedGames = new ScriptedGamesReader();
        const scriptedGamesFollowUps = new ScriptedFollowUpReader({ collabs: true });
        const gamesFollowUps = llm
          ? new FallbackFollowUpReader(
              new ModelGamesFollowUpReader(llm.model('agent'), llm.timeoutMs),
              scriptedGamesFollowUps,
              (err) => logger.warn(`Model follow-up reader failed, using the scripted one: ${err}`),
            )
          : scriptedGamesFollowUps;
        const games = new GamesAgent({
          reader: llm
            ? new FallbackGamesReader(
                new ModelGamesReader(llm.model('agent'), llm.timeoutMs),
                scriptedGames,
                (err) =>
                  logger.warn(`Model reader failed, reading with the scripted reader: ${err}`),
              )
            : scriptedGames,
          queries: llm
            ? new FallbackGamesQueryPlanner(
                new ModelGamesQueryPlanner(llm.model('agent'), llm.timeoutMs),
                new ScriptedGamesQueryPlanner(),
                (err) => logger.warn(`Model query planner failed, using the defaults: ${err}`),
              )
            : new ScriptedGamesQueryPlanner(),
          writer: llm
            ? new FallbackGamesPlanWriter(
                new ModelGamesPlanWriter(
                  llm.model('writer'),
                  llm.writerTimeoutMs,
                  llm.writerOptions,
                ),
                new TemplateGamesPlanWriter(),
                (err) => logger.warn(`Model writer failed, writing from templates: ${err}`),
              )
            : new TemplateGamesPlanWriter(),
          results,
          report: llm
            ? new FallbackGamesReportWriter(
                new ModelGamesReportWriter(
                  llm.model('writer'),
                  llm.writerTimeoutMs,
                  llm.writerOptions,
                ),
                new TemplateGamesReportWriter(),
                (err) => logger.warn(`Model report writer failed, writing from templates: ${err}`),
              )
            : new TemplateGamesReportWriter(),
          research:
            llm && search
              ? new FallbackGamesResearcher(
                  new ModelGamesResearcher(search, llm.model('agent'), llm.writerTimeoutMs),
                  (err) => logger.warn(`Web research failed, writing without it: ${err}`),
                )
              : new NoResearch(),
          followUps: gamesFollowUps,
          tools,
          plan: (id) => outputs.plan(id),
          planner: planFor,
          maxSteps,
          analyst,
          researchPlanner,
          reviewer,
          standalone,
        });

        // Podcasts shares the tools, the results reader and the search; its readers, planner and
        // writers carry the podcasts prompts. Its scripted follow-up reader also reads a swap.
        const scriptedPodcasts = new ScriptedPodcastsReader();
        const scriptedPodcastsFollowUps = new ScriptedFollowUpReader({ collabs: true });
        const podcastsFollowUps = llm
          ? new FallbackFollowUpReader(
              new ModelPodcastsFollowUpReader(llm.model('agent'), llm.timeoutMs),
              scriptedPodcastsFollowUps,
              (err) => logger.warn(`Model follow-up reader failed, using the scripted one: ${err}`),
            )
          : scriptedPodcastsFollowUps;
        const podcasts = new PodcastsAgent({
          reader: llm
            ? new FallbackPodcastsReader(
                new ModelPodcastsReader(llm.model('agent'), llm.timeoutMs),
                scriptedPodcasts,
                (err) =>
                  logger.warn(`Model reader failed, reading with the scripted reader: ${err}`),
              )
            : scriptedPodcasts,
          queries: llm
            ? new FallbackPodcastsQueryPlanner(
                new ModelPodcastsQueryPlanner(llm.model('agent'), llm.timeoutMs),
                new ScriptedPodcastsQueryPlanner(),
                (err) => logger.warn(`Model query planner failed, using the defaults: ${err}`),
              )
            : new ScriptedPodcastsQueryPlanner(),
          writer: llm
            ? new FallbackPodcastsPlanWriter(
                new ModelPodcastsPlanWriter(
                  llm.model('writer'),
                  llm.writerTimeoutMs,
                  llm.writerOptions,
                ),
                new TemplatePodcastsPlanWriter(),
                (err) => logger.warn(`Model writer failed, writing from templates: ${err}`),
              )
            : new TemplatePodcastsPlanWriter(),
          results,
          report: llm
            ? new FallbackPodcastsReportWriter(
                new ModelPodcastsReportWriter(
                  llm.model('writer'),
                  llm.writerTimeoutMs,
                  llm.writerOptions,
                ),
                new TemplatePodcastsReportWriter(),
                (err) => logger.warn(`Model report writer failed, writing from templates: ${err}`),
              )
            : new TemplatePodcastsReportWriter(),
          research:
            llm && search
              ? new FallbackPodcastsResearcher(
                  new ModelPodcastsResearcher(search, llm.model('agent'), llm.writerTimeoutMs),
                  (err) => logger.warn(`Web research failed, writing without it: ${err}`),
                )
              : new NoResearch(),
          followUps: podcastsFollowUps,
          tools,
          plan: (id) => outputs.plan(id),
          planner: planFor,
          maxSteps,
          analyst,
          researchPlanner,
          reviewer,
          standalone,
        });

        // Books shares the tools, the results reader and the search; its readers, planner and
        // writers carry the books prompts. Its scripted follow-up reader also reads a screen title.
        const scriptedBooks = new ScriptedBooksReader();
        const scriptedBooksFollowUps = new ScriptedFollowUpReader({
          collabs: true,
          collabWords: /\b(screen (?:comparison|title)|adapt\w*|compare (?:it )?(?:with|to))\b/i,
        });
        const booksFollowUps = llm
          ? new FallbackFollowUpReader(
              new ModelBooksFollowUpReader(llm.model('agent'), llm.timeoutMs),
              scriptedBooksFollowUps,
              (err) => logger.warn(`Model follow-up reader failed, using the scripted one: ${err}`),
            )
          : scriptedBooksFollowUps;
        const books = new BooksAgent({
          reader: llm
            ? new FallbackBooksReader(
                new ModelBooksReader(llm.model('agent'), llm.timeoutMs),
                scriptedBooks,
                (err) =>
                  logger.warn(`Model reader failed, reading with the scripted reader: ${err}`),
              )
            : scriptedBooks,
          queries: llm
            ? new FallbackBooksQueryPlanner(
                new ModelBooksQueryPlanner(llm.model('agent'), llm.timeoutMs),
                new ScriptedBooksQueryPlanner(),
                (err) => logger.warn(`Model query planner failed, using the defaults: ${err}`),
              )
            : new ScriptedBooksQueryPlanner(),
          writer: llm
            ? new FallbackBooksPlanWriter(
                new ModelBooksPlanWriter(
                  llm.model('writer'),
                  llm.writerTimeoutMs,
                  llm.writerOptions,
                ),
                new TemplateBooksPlanWriter(),
                (err) => logger.warn(`Model writer failed, writing from templates: ${err}`),
              )
            : new TemplateBooksPlanWriter(),
          results,
          report: llm
            ? new FallbackBooksReportWriter(
                new ModelBooksReportWriter(
                  llm.model('writer'),
                  llm.writerTimeoutMs,
                  llm.writerOptions,
                ),
                new TemplateBooksReportWriter(),
                (err) => logger.warn(`Model report writer failed, writing from templates: ${err}`),
              )
            : new TemplateBooksReportWriter(),
          research:
            llm && search
              ? new FallbackBooksResearcher(
                  new ModelBooksResearcher(search, llm.model('agent'), llm.writerTimeoutMs),
                  (err) => logger.warn(`Web research failed, writing without it: ${err}`),
                )
              : new NoResearch(),
          followUps: booksFollowUps,
          tools,
          plan: (id) => outputs.plan(id),
          planner: planFor,
          maxSteps,
          analyst,
          researchPlanner,
          reviewer,
          standalone,
        });
        return { ...placeholderAgents(), film, music, books, games, podcasts, shows };
      },
    },
    {
      provide: MEMORY_WRITER,
      inject: [LLM],
      useFactory: (llm: Llm | null) => {
        const scripted = new ScriptedMemoryWriter();
        if (!llm) return scripted;
        return new FallbackMemoryWriter(
          new ModelMemoryWriter(llm.model('router'), llm.timeoutMs),
          scripted,
          (err) => logger.warn(`Model memory writer failed, keeping only plans: ${err}`),
        );
      },
    },
    {
      provide: CHAT_SUMMARIZER,
      inject: [LLM],
      useFactory: (llm: Llm | null) => {
        const scripted = new ScriptedChatSummarizer();
        if (!llm) return scripted;
        return new FallbackChatSummarizer(
          new ModelChatSummarizer(llm.model('router'), llm.timeoutMs),
          scripted,
          (err) => logger.warn(`Model summariser failed, keeping the person's words: ${err}`),
        );
      },
    },
    {
      provide: VERSIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const get = <K extends keyof Env>(key: K) => config.get(key, { infer: true });
        const writes = get('LLM_API_KEY') !== '' || get('LLM_WRITER_API_KEY') !== '';
        return versionsOf({
          writerModel: writes ? get('LLM_WRITER_MODEL') || get('LLM_MODEL') : '',
          qlooMode: get('QLOO_MODE'),
          qlooBaseUrl: get('QLOO_BASE_URL'),
          codeVersion: get('CODE_VERSION'),
        });
      },
    },
    MemoryStore,
    OutputStore,
    OutputsService,
  ],
  exports: [RunService, ThreadStore, OutputsService, MemoryStore],
})
export class AgentModule {}

// One Qloo client per run, so the call budget and the cache are the run's (spec §3.5). The slots
// are shared, so runs at once stay under the host's rate limit together.
function toolContext(config: ConfigService<Env, true>, slots: RequestSlots): ToolContext {
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
    slots,
  });
  return { qloo, source: 'qloo', entities: new Map() };
}
