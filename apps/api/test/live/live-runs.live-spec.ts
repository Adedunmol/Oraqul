import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { outputDetailSchema, type ThreadDetail, threadDetailSchema } from '@oraqul/schema';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { qaCheck, summarise } from '../../src/agent/qa/qa-check.js';
import { RunService } from '../../src/agent/run.service.js';
import { AuthModule } from '../../src/auth/auth.module.js';
import { type AuthedRequest, SessionGuard } from '../../src/auth/session.guard.js';
import { UsersService } from '../../src/auth/users.service.js';
import { envSchema } from '../../src/config/env.js';
import { DB, DbModule } from '../../src/db/db.module.js';
import { LlmModule } from '../../src/llm/llm.module.js';
import { ProjectsModule } from '../../src/projects/projects.module.js';
import { TeamsService } from '../../src/teams/teams.service.js';
import { createTestDatabase } from '../test-database.js';

// Live runs (docs/testing.md): real briefs through the real agents, on live Qloo and the configured
// models, in an in-process Postgres. Each plan is saved, checked by the QA checker and written to
// packages/eval/live/out. Run with `pnpm --filter @oraqul/api test:live`; it needs the keys in .env,
// spends Qloo calls and model tokens, and is skipped without LIVE_RUNS=1.
//
//   LIVE_ONLY=film-bare,books-how-to-be-a-man    only these briefs
//   RECORD_EXAMPLES=1                            also write the marketing examples

try {
  process.loadEnvFile(fileURLToPath(new URL('../../../../.env', import.meta.url)));
} catch {
  // Without a .env the keys must already be in the environment.
}

const root = fileURLToPath(new URL('../../../../packages/eval/live/', import.meta.url));
const examplesDir = fileURLToPath(new URL('../../../web/src/lib/examples/', import.meta.url));

const briefsSchema = z.array(
  z.object({
    name: z.string(),
    category: z.enum(['film', 'music', 'books', 'podcasts', 'games', 'shows']),
    mode: z.enum(['build', 'audit', 'fix']),
    text: z.string(),
    /** The name the person gives when the router asks what it is called. */
    title: z.string().optional(),
    replies: z.array(z.object({ text: z.string() })).default([]),
    /** The marketing example this run becomes when RECORD_EXAMPLES=1. */
    example: z.enum(['film', 'music', 'podcasts', 'books']).optional(),
  }),
);

const only = process.env.LIVE_ONLY?.split(',').map((s) => s.trim());
const briefs = briefsSchema
  .parse(JSON.parse(readFileSync(`${root}briefs.json`, 'utf8')))
  .filter((b) => !only || only.includes(b.name));

const POLL_MS = 1000;
const MAX_WAIT_MS = 25 * 60_000;

describe.skipIf(process.env.LIVE_RUNS !== '1')('Live runs of the real agents', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication<App>;
  let runService: RunService;
  let teamId: string;
  const as = { 'x-test-user': 'live-owner@example.com' };
  const http = () => app.getHttpServer();

  async function settled(threadId: string, afterPost = false): Promise<ThreadDetail> {
    // A posted answer starts its run a moment later, so wait for it to begin before waiting for it to end.
    if (afterPost) {
      const began = Date.now();
      while (!runService.isBusy(threadId) && Date.now() - began < 15_000) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    const start = Date.now();
    while (runService.isBusy(threadId) && Date.now() - start < MAX_WAIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    const res = await request(http()).get(`/threads/${threadId}`).set(as).expect(200);
    return threadDetailSchema.parse(res.body);
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    const accounts = new UsersService(database.db);
    const owner = await accounts.findOrCreateVerified('live-owner@example.com', 'Live');
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () =>
            envSchema.parse({
              ...process.env,
              DATABASE_URL: 'postgres://u:p@localhost:5433/db',
              SESSION_SECRET: 'x'.repeat(32),
              WEB_ORIGIN: 'http://localhost:3000',
              QLOO_MODE: 'live',
              BRAND_CHECK: 'on',
            }),
        }),
        DbModule,
        LlmModule,
        AuthModule,
        ProjectsModule,
      ],
      providers: [TeamsService],
    })
      .overrideProvider(DB)
      .useValue(database.db)
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate: async (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<AuthedRequest>();
          const user = await accounts.findByEmail(req.header('x-test-user') ?? '');
          if (!user) throw new UnauthorizedException();
          req.user = user;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    runService = moduleRef.get(RunService);
    teamId = (await moduleRef.get(TeamsService).create(owner.id, 'Live team')).id;
    mkdirSync(`${root}out`, { recursive: true });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it.each(briefs.map((b) => [b.name, b] as const))(
    '%s',
    async (_name, brief) => {
      const started = Date.now();
      const created = await request(http())
        .post(`/teams/${teamId}/projects`)
        .set(as)
        .send({ text: brief.text, mode: brief.mode, category: brief.category })
        .expect(201);
      const { threadId } = created.body as { threadId: string };

      let thread = await settled(threadId);
      const asked: string[] = [];
      const replies = [...brief.replies];
      // A card the run leaves open is answered from the brief's replies, else the first option.
      for (let guard = 0; guard < 6; guard++) {
        const last = thread.items.at(-1);
        if (last?.role !== 'question' || last.answer !== null) break;
        asked.push(`${last.question.id}: ${last.question.prompt}`);
        // The router asks what it is called when the brief names no title.
        const reply =
          last.question.id.startsWith('router.') && brief.title
            ? { text: brief.title }
            : replies.shift();
        if (reply) {
          await request(http())
            .post(`/threads/${threadId}/messages`)
            .set(as)
            .send({ kind: 'text', text: reply.text })
            .expect(202);
        } else if (last.question.card === 'single' || last.question.card === 'multi') {
          const first = last.question.options[0];
          if (!first) break;
          await request(http())
            .post(`/threads/${threadId}/messages`)
            .set(as)
            .send({
              kind: 'answer',
              answer: { kind: 'options', questionId: last.question.id, optionIds: [first.id] },
            })
            .expect(202);
        } else {
          break;
        }
        thread = await settled(threadId, true);
      }

      const messages = thread.items.flatMap((i) => (i.role === 'agent' ? [i.text] : []));
      const outputId = thread.outputs.at(-1)?.id;
      const summary: Record<string, unknown> = {
        name: brief.name,
        seconds: Math.round((Date.now() - started) / 1000),
        asked,
        messages,
        output: outputId ?? null,
      };

      if (outputId) {
        const detail = outputDetailSchema.parse(
          (await request(http()).get(`/outputs/${outputId}`).set(as).expect(200)).body,
        );
        writeFileSync(`${root}out/${brief.name}.json`, `${JSON.stringify(detail, null, 2)}\n`);
        const md = await request(http()).get(`/outputs/${outputId}/export/md`).set(as).expect(200);
        writeFileSync(`${root}out/${brief.name}.md`, md.text);
        summary.receipts = detail.output.receipts.length;
        summary.sources = [...new Set(detail.output.receipts.map((r) => r.source))];

        const plan = detail.output.plan;
        if (plan) {
          const found = qaCheck({
            plan,
            cannot: detail.output.brief.cannot,
            briefText: [brief.text, brief.title ?? '', ...brief.replies.map((r) => r.text)].join(
              '\n',
            ),
            today: new Date().toISOString().slice(0, 10),
          });
          summary.qa = { counts: summarise(found), found };
        }

        if (process.env.RECORD_EXAMPLES === '1' && brief.example) {
          // The public example is the share view: redacted exactly as a share link is.
          const on = await request(http())
            .put(`/outputs/${outputId}/share`)
            .set(as)
            .send({ enabled: true })
            .expect(200);
          const shared = await request(http())
            .get(`/s/${(on.body as { token: string }).token}`)
            .expect(200);
          const seen = outputDetailSchema.parse(shared.body);
          writeFileSync(
            `${examplesDir}${brief.example}.json`,
            `${JSON.stringify(seen, null, 2)}\n`,
          );
          // What the person wrote, shown above the example so a reader sees brief and plan together.
          const briefsFile = `${examplesDir}briefs.json`;
          let written: Record<string, string> = {};
          try {
            written = z
              .record(z.string(), z.string())
              .parse(JSON.parse(readFileSync(briefsFile, 'utf8')));
          } catch {
            // The first example creates the file.
          }
          writeFileSync(
            briefsFile,
            `${JSON.stringify({ ...written, [brief.example]: [brief.text, ...brief.replies.map((r) => r.text)].join(' ') }, null, 2)}\n`,
          );
        }
      }
      writeFileSync(
        `${root}out/${brief.name}.summary.json`,
        `${JSON.stringify(summary, null, 2)}\n`,
      );
      // A run that stopped with neither a plan nor a question is a failure to read, not to hide.
      expect(outputId !== undefined || asked.length > 0 || messages.length > 0).toBe(true);
    },
    MAX_WAIT_MS * 2,
  );
});
