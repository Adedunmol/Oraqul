import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { outputDetailSchema, type ThreadDetail, threadDetailSchema } from '@oraqul/schema';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { RunService } from '../src/agent/run.service.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { type AuthedRequest, SessionGuard } from '../src/auth/session.guard.js';
import { UsersService } from '../src/auth/users.service.js';
import { envSchema } from '../src/config/env.js';
import { DB, DbModule } from '../src/db/db.module.js';
import { memberships, runs } from '../src/db/schema.js';
import { LlmModule } from '../src/llm/llm.module.js';
import { ProjectsModule } from '../src/projects/projects.module.js';
import { TeamsService } from '../src/teams/teams.service.js';
import { createTestDatabase } from './test-database.js';

// No model key and QLOO_MODE=demo: the scripted router and reader, and hand-written Qloo data.
describe('Music build end to end (real agents, demo Qloo, scripted reader)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication<App>;
  let runService: RunService;
  let teamId: string;
  const as = { 'x-test-user': 'music-owner@example.com' };
  const viewer = { 'x-test-user': 'music-viewer@example.com' };
  const http = () => app.getHttpServer();

  async function settled(threadId: string): Promise<ThreadDetail> {
    for (let i = 0; i < 300 && runService.isBusy(threadId); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const res = await request(http()).get(`/threads/${threadId}`).set(as).expect(200);
    return threadDetailSchema.parse(res.body);
  }

  async function start(text: string, mode: 'build' | 'audit' | 'fix') {
    const res = await request(http())
      .post(`/teams/${teamId}/projects`)
      .set(as)
      .send({ text, mode, category: 'music' })
      .expect(201);
    return res.body as { projectId: string; threadId: string };
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    const accounts = new UsersService(database.db);
    const owner = await accounts.findOrCreateVerified('music-owner@example.com', 'Ada');
    const reader = await accounts.findOrCreateVerified('music-viewer@example.com', 'Viv');
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () =>
            envSchema.parse({
              DATABASE_URL: 'postgres://u:p@localhost:5433/db',
              SESSION_SECRET: 'x'.repeat(32),
              WEB_ORIGIN: 'http://localhost:3000',
              QLOO_MODE: 'demo',
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
    teamId = (await moduleRef.get(TeamsService).create(owner.id, 'Label')).id;
    await database.db.insert(memberships).values({ teamId, userId: reader.id, role: 'viewer' });
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it('plans a release: the artist is an anchor, the plan has a tour order and support acts', async () => {
    const { threadId } = await start(
      'Launch plan for my album "Night Songs" by artist "Neon Tide", an afrobeats release for 18 to 34 year olds, touring Lagos and London. Sound-alikes: "Ada Lux" and "Kola Wave".',
      'build',
    );
    const done = await settled(threadId);
    expect(done.items.some((i) => i.role === 'question')).toBe(false);
    const findings = done.items.flatMap((i) => (i.role === 'trace' ? i.findings : []));
    expect(findings.length).toBeGreaterThan(0);
    const outputItem = done.items.find((i) => i.role === 'output');
    if (outputItem?.role !== 'output') throw new Error('Expected an output in the chat');

    const { output } = outputDetailSchema.parse(
      (await request(http()).get(`/outputs/${outputItem.outputId}`).set(viewer).expect(200)).body,
    );
    expect(output.label).toBe('v1 · Night Songs');
    expect(output.tabs.map((t) => t.key)).toEqual([
      'plan',
      'route',
      'supportacts',
      'audience',
      'assumptions',
      'contrast',
      'evidence',
    ]);
    if (!output.plan) throw new Error('Expected a launch plan');
    expect(output.plan.comps.map((c) => c.name).sort()).toEqual(['Ada Lux', 'Kola Wave']);
    const keys = output.plan.sections.map((s) => s.key);
    for (const key of ['tour', 'support', 'sync'] as const) expect(keys).toContain(key);
    expect(output.brief.assumptions.map((a) => a.id)).toContain('a-route');
    const cited = new Set(output.receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
    for (const f of output.plan.findings) expect(cited.has(f.id)).toBe(true);
    expect(output.headline).toMatch(/^Start in (Lagos|London)/);
    expect(output.receipts.every((r) => r.source === 'demo')).toBe(true);

    const [run] = await database.db
      .select({ qlooCalls: runs.qlooCalls })
      .from(runs)
      .where(eq(runs.agent, 'music'))
      .orderBy(runs.createdAt);
    expect(run?.qlooCalls).toBeGreaterThan(0);

    const md = await request(http())
      .get(`/outputs/${outputItem.outputId}/export/md`)
      .set(viewer)
      .expect(200);
    expect(md.text).toContain('## Tour route');
    expect(md.text).toContain('## Support acts');
    expect(md.text).toMatch(/\[\^1\]: /);
    for (const r of output.receipts) expect(md.text).not.toContain(r.callId);
  });

  it('answers, reruns a what-if, checks rival dates and drafts a partner brief', async () => {
    const { threadId } = await start(
      'Launch plan for my album "Night Songs" by artist "Neon Tide", an afrobeats release for 18 to 34 year olds, touring Lagos and London. Sound-alikes: "Ada Lux" and "Kola Wave".',
      'build',
    );
    const planned = await settled(threadId);
    const plan = planned.outputs[0];
    if (!plan) throw new Error(`Expected a plan, got ${JSON.stringify(planned.items.at(-1))}`);

    const say = async (text: string) => {
      await request(http())
        .post(`/threads/${threadId}/messages`)
        .set(as)
        .send({ kind: 'text', text })
        .expect(202);
      return settled(threadId);
    };

    // A question: answered from the plan's findings, checked, with no new output.
    const answered = await say('Which support acts should open the shows?');
    expect(answered.outputs).toHaveLength(1);
    const reply = answered.items.findLast((i) => i.role === 'agent');
    const texts = plan.plan?.findings.map((f) => f.text) ?? [];
    expect(texts.some((t) => reply?.role === 'agent' && reply.text.includes(t))).toBe(true);

    // A what-if: a new scenario built on the plan, with what changed.
    const whatIf = await say('What if we play Accra instead of London?');
    const scenario = whatIf.outputs.find((o) => o.kind === 'scenario');
    if (!scenario) throw new Error('Expected a scenario');
    expect(scenario.parentId).toBe(plan.id);
    expect(scenario.title).toBe('Night Songs: add Accra, drop London');
    expect(scenario.brief.assumptions.map((a) => a.id)).toContain('a-place-accra');
    expect(scenario.plan?.sections.some((s) => s.key === 'tour')).toBe(true);

    // A rival date check: one line per rival, with the safest week chosen.
    const dated = await say(
      'Check rival dates: "Ada Lux" on 2026-12-04 and "Kola Wave" on 2026-12-11.',
    );
    const check = dated.outputs.find((o) => o.kind === 'date');
    if (!check) throw new Error('Expected a date check');
    expect(check.brief.dates.map((d) => d.rival).sort()).toEqual(['Ada Lux', 'Kola Wave']);

    // A partner brief: scored against the baseline, drafted, never sent.
    const briefed = await say('Draft a partner brief for "Lagoon Mobile"');
    const partner = briefed.outputs.find((o) => o.kind === 'partner');
    if (!partner) throw new Error('Expected a partner brief');
    expect(partner.brief.partners[0]).toMatchObject({ name: 'Lagoon Mobile', type: 'Brand' });
    expect(partner.brief.partners[0]?.draft).toContain('Hi Lagoon Mobile team');
  });

  it('audits a plan as a report, then fixes it in the same project', async () => {
    const { threadId } = await start(
      'Our plan for "Night Songs", an afrobeats album from artist "Neon Tide" for women aged 25 to 34, touring Lagos and London, with support from "Sade Rhythm". Sound-alikes: "Ada Lux" and "Kola Wave".',
      'audit',
    );
    const audited = await settled(threadId);
    expect(audited.items.some((i) => i.role === 'question')).toBe(false);
    const report = audited.outputs[0];
    if (!report?.report) throw new Error('Expected an audit report');
    expect(report.kind).toBe('audit');
    expect(report.plan).toBeNull();
    const ids = report.report.items.map((i) => i.id);
    expect(ids).toContain('a-route');
    expect(ids).toContain('a-artist-sade-rhythm');
    expect(audited.thread.baseOutputId).toBe(report.id);

    await request(http())
      .post(`/threads/${threadId}/messages`)
      .set(as)
      .send({ kind: 'text', text: 'Fix this plan' })
      .expect(202);
    const fixed = await settled(threadId);
    expect(fixed.outputs.map((o) => o.kind)).toEqual(['audit', 'fix']);
    const plan = fixed.outputs[1];
    if (!plan?.plan) throw new Error('Expected a fixed plan');
    expect(plan.parentId).toBe(report.id);
    expect(plan.tabs.map((t) => t.key)).toEqual([
      'plan',
      'fixes',
      'route',
      'supportacts',
      'audience',
      'assumptions',
      'contrast',
      'evidence',
    ]);
    expect(plan.receipts.every((r) => r.source === 'demo')).toBe(true);
  });
});
