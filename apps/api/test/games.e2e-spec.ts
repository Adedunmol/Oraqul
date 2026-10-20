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
describe('Games build end to end (real agents, demo Qloo, scripted reader)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication<App>;
  let runService: RunService;
  let teamId: string;
  const as = { 'x-test-user': 'games-owner@example.com' };
  const viewer = { 'x-test-user': 'games-viewer@example.com' };
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
      .send({ text, mode, category: 'games' })
      .expect(201);
    return res.body as { projectId: string; threadId: string };
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    const accounts = new UsersService(database.db);
    const owner = await accounts.findOrCreateVerified('games-owner@example.com', 'Ada');
    const reader = await accounts.findOrCreateVerified('games-viewer@example.com', 'Viv');
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
    teamId = (await moduleRef.get(TeamsService).create(owner.id, 'Studio')).id;
    await database.db.insert(memberships).values({ teamId, userId: reader.id, role: 'viewer' });
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  const BRIEF =
    'Launch plan for the game "Ember Keep", a roguelike for Steam and Switch for 18 to 34 year olds, launching in London and Seoul on 2099-03-01. Comparable games: "Hollow Hills" and "Crown of Ash". Collab with "Pixel Choir".';

  it('plans a launch: a fan base bridge, regions, platform tests and a calendar from code', async () => {
    const { threadId } = await start(BRIEF, 'build');
    const done = await settled(threadId);
    expect(done.items.some((i) => i.role === 'question')).toBe(false);
    const findings = done.items.flatMap((i) => (i.role === 'trace' ? i.findings : []));
    expect(findings.length).toBeGreaterThan(0);
    const outputItem = done.items.find((i) => i.role === 'output');
    if (outputItem?.role !== 'output') throw new Error('Expected an output in the chat');

    const { output } = outputDetailSchema.parse(
      (await request(http()).get(`/outputs/${outputItem.outputId}`).set(viewer).expect(200)).body,
    );
    expect(output.label).toBe('v1 · Ember Keep');
    expect(output.tabs.map((t) => t.key)).toEqual([
      'plan',
      'fanbase',
      'regions',
      'audience',
      'assumptions',
      'evidence',
    ]);
    if (!output.plan) throw new Error('Expected a launch plan');
    expect(output.plan.comps.map((c) => c.name).sort()).toEqual(['Crown of Ash', 'Hollow Hills']);
    const keys = output.plan.sections.map((s) => s.key);
    for (const key of ['store', 'events', 'collabs', 'creators', 'timeline'] as const) {
      expect(keys).toContain(key);
    }
    expect(output.brief.assumptions.map((a) => a.id)).toContain('a-platform');
    expect(
      output.brief.fan?.some((f) => f.name === 'Pixel Choir' && f.note === 'Your collab'),
    ).toBe(true);
    const cited = new Set(output.receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
    for (const f of output.plan.findings) expect(cited.has(f.id)).toBe(true);
    for (const f of output.brief.fan ?? []) expect(cited.has(f.id)).toBe(true);
    expect(output.limits).toContain('Wishlists, sales, player counts and reviews');
    expect(output.receipts.every((r) => r.source === 'demo')).toBe(true);

    const [run] = await database.db
      .select({ qlooCalls: runs.qlooCalls })
      .from(runs)
      .where(eq(runs.agent, 'games'))
      .orderBy(runs.createdAt);
    expect(run?.qlooCalls).toBeGreaterThan(0);

    const md = await request(http())
      .get(`/outputs/${outputItem.outputId}/export/md`)
      .set(viewer)
      .expect(200);
    expect(md.text).toContain('## Launch beats');
    expect(md.text).toContain('## Fan base collabs');
    for (const r of output.receipts) expect(md.text).not.toContain(r.callId);
  });

  it('answers, reruns a collab what-if, checks rival dates and drafts a partner brief', async () => {
    const { threadId } = await start(BRIEF, 'build');
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

    // A question: answered from the plan's findings, with no new output.
    const answered = await say('Which podcasts should we pitch?');
    expect(answered.outputs).toHaveLength(1);

    // A what-if that adds a collab: a new scenario that ranks it beside the first.
    const whatIf = await say('What if we also collab with "Kitsune Drift"?');
    const scenario = whatIf.outputs.find((o) => o.kind === 'scenario');
    if (!scenario) throw new Error('Expected a scenario');
    expect(scenario.parentId).toBe(plan.id);
    expect(scenario.title).toBe('Ember Keep: collab with Kitsune Drift');
    const collabs = (scenario.brief.fan ?? []).filter((f) => f.note === 'Your collab');
    expect(collabs.map((f) => f.name).sort()).toEqual(['Kitsune Drift', 'Pixel Choir']);

    // A rival date check: another game, scored as a game.
    const dated = await say('Check rival dates: "Hollow Hills" on 2026-12-04.');
    const check = dated.outputs.find((o) => o.kind === 'date');
    if (!check) throw new Error('Expected a date check');
    expect(check.brief.dates.map((d) => d.rival)).toEqual(['Hollow Hills']);

    // A partner brief: scored against the baseline, drafted, never sent.
    const briefed = await say('Draft a partner brief for "Voltage Energy"');
    const partner = briefed.outputs.find((o) => o.kind === 'partner');
    if (!partner) throw new Error('Expected a partner brief');
    expect(partner.brief.partners[0]).toMatchObject({ name: 'Voltage Energy', type: 'Brand' });
  });

  it('audits a plan as a report, then fixes it in the same project', async () => {
    const { threadId } = await start(
      'Our plan for "Ember Keep", a roguelike for Steam and Xbox for people aged 25 to 34, launching in London and Seoul. Comparable games: "Hollow Hills" and "Crown of Ash". Collab with "Pixel Choir". Store tags: Roguelike, Indie.',
      'audit',
    );
    const audited = await settled(threadId);
    expect(audited.items.some((i) => i.role === 'question')).toBe(false);
    const report = audited.outputs[0];
    if (!report?.report) throw new Error('Expected an audit report');
    expect(report.kind).toBe('audit');
    expect(report.plan).toBeNull();
    const ids = report.report.items.map((i) => i.id);
    for (const id of ['a-platform', 'a-store-tags', 'a-collab-pixel-choir']) {
      expect(ids).toContain(id);
    }

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
      'fanbase',
      'regions',
      'audience',
      'assumptions',
      'evidence',
    ]);
    expect(plan.receipts.every((r) => r.source === 'demo')).toBe(true);
  });
});
