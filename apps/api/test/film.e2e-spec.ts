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
import { memberships, receipts, runs } from '../src/db/schema.js';
import { LlmModule } from '../src/llm/llm.module.js';
import { ProjectsModule } from '../src/projects/projects.module.js';
import { TeamsService } from '../src/teams/teams.service.js';
import { createTestDatabase } from './test-database.js';

// No model key and QLOO_MODE=demo: the scripted router and reader, and hand-written Qloo data.
describe('Film build end to end (real agents, demo Qloo, scripted reader)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication<App>;
  let runService: RunService;
  let teamId: string;
  const as = { 'x-test-user': 'film-owner@example.com' };
  const viewer = { 'x-test-user': 'film-viewer@example.com' };
  const stranger = { 'x-test-user': 'film-stranger@example.com' };
  const http = () => app.getHttpServer();

  async function settled(threadId: string): Promise<ThreadDetail> {
    for (let i = 0; i < 300 && runService.isBusy(threadId); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const res = await request(http()).get(`/threads/${threadId}`).set(as).expect(200);
    return threadDetailSchema.parse(res.body);
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    const accounts = new UsersService(database.db);
    const owner = await accounts.findOrCreateVerified('film-owner@example.com', 'Ada');
    const reader = await accounts.findOrCreateVerified('film-viewer@example.com', 'Viv');
    await accounts.findOrCreateVerified('film-stranger@example.com', 'Sam');
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

  it('plans a film launch: reads the brief, settles the comps, saves a plan on findings', async () => {
    const res = await request(http())
      .post(`/teams/${teamId}/projects`)
      .set(as)
      .send({
        text: 'Launch plan for my film "Night Ferry", a thriller for 18 to 34 year olds opening in Lagos and London. Comps: "Salt Road", "The Glass Lantern" and "Midnight Harbor".',
        mode: 'build',
        category: 'film',
      })
      .expect(201);
    const { threadId } = res.body as { threadId: string };

    // No comps or match card: code settles the same-name comp and the plan says so.
    const done = await settled(threadId);
    expect(done.items.some((i) => i.role === 'question')).toBe(false);
    // Findings stream into the Film trace while the queries run.
    const findings = done.items.flatMap((i) => (i.role === 'trace' ? i.findings : []));
    expect(findings.length).toBeGreaterThan(0);
    const outputItem = done.items.find((i) => i.role === 'output');
    if (outputItem?.role !== 'output') throw new Error('Expected an output in the chat');
    expect(done.outputs).toHaveLength(1);
    expect(done.projectOutputs.map((o) => o.id)).toEqual([outputItem.outputId]);
    expect(done.thread.baseOutputId).toBe(outputItem.outputId);

    const detail = outputDetailSchema.parse(
      (await request(http()).get(`/outputs/${outputItem.outputId}`).set(viewer).expect(200)).body,
    );
    const { output } = detail;
    expect(output.label).toBe('v1 · Night Ferry');
    expect(output.tabs.map((t) => t.key)).toEqual(['plan', 'audience', 'assumptions', 'evidence']);
    if (!output.plan) throw new Error('Expected a launch plan');
    expect(output.plan.comps.find((c) => c.name === 'Midnight Harbor')?.choice).toBeTruthy();
    const cited = new Set(output.receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
    for (const f of output.plan.findings) expect(cited.has(f.id)).toBe(true);
    for (const move of output.moves) expect(cited.has(move.lineId ?? '')).toBe(true);
    expect(output.headline).toMatch(/^Open in (Lagos|London) first/);
    expect(output.evidence.length).toBeGreaterThan(0);
    expect(output.receipts.every((r) => r.source === 'demo')).toBe(true);
    expect(detail.project.name).toBe('Night Ferry');

    const [run] = await database.db
      .select({ qlooCalls: runs.qlooCalls })
      .from(runs)
      .where(eq(runs.agent, 'film'))
      .orderBy(runs.createdAt);
    expect(run?.qlooCalls).toBeGreaterThan(0);
    const saved = await database.db.select().from(receipts).where(eq(receipts.threadId, threadId));
    expect(saved.length).toBeGreaterThan(0);

    await request(http()).get(`/outputs/${outputItem.outputId}`).set(stranger).expect(403);

    // Exports: grounded lines footnoted to findings, playbook lines labelled, no call ids.
    const md = await request(http())
      .get(`/outputs/${outputItem.outputId}/export/md`)
      .set(viewer)
      .expect(200);
    expect(md.text).toContain('## In brief');
    expect(md.text).toMatch(/\[\^1\]: /);
    for (const r of output.receipts) expect(md.text).not.toContain(r.callId);
    const docx = await request(http())
      .get(`/outputs/${outputItem.outputId}/export/docx`)
      .set(viewer)
      .buffer(true)
      .expect(200);
    expect(docx.headers['content-type']).toContain('wordprocessingml');
    expect(docx.headers['content-disposition']).toContain('Night-Ferry.docx');
    const pdf = await request(http())
      .get(`/outputs/${outputItem.outputId}/export/pdf`)
      .set(viewer)
      .buffer(true)
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    await request(http()).get(`/outputs/${outputItem.outputId}/export/txt`).set(viewer).expect(400);
    await request(http())
      .get(`/outputs/${outputItem.outputId}/export/md`)
      .set(stranger)
      .expect(403);
  });

  it('answers, reruns a what-if, checks rival dates and drafts a partner brief', async () => {
    const res = await request(http())
      .post(`/teams/${teamId}/projects`)
      .set(as)
      .send({
        text: 'Launch plan for my film "Night Ferry" for 18 to 34 year olds, opening in Lagos and London. Comps: "Salt Road", "The Glass Lantern" and "Harbor Lights".',
        mode: 'build',
        category: 'film',
      })
      .expect(201);
    const { projectId, threadId } = res.body as { projectId: string; threadId: string };
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
    const answered = await say('Which cinemas should we screen at?');
    expect(answered.outputs).toHaveLength(1);
    expect(answered.items.findLast((i) => i.role === 'context')).toMatchObject({
      items: expect.arrayContaining([{ source: 'plan', label: plan.label }]),
    });
    const reply = answered.items.findLast((i) => i.role === 'agent');
    const findings = plan.plan?.findings.map((f) => f.text) ?? [];
    expect(findings.some((f) => reply?.role === 'agent' && reply.text.includes(f))).toBe(true);

    // A what-if: a new scenario version built on the plan, with what changed.
    const whatIf = await say('What if we open in Accra instead of London?');
    const scenario = whatIf.outputs.find((o) => o.kind === 'scenario');
    if (!scenario) throw new Error('Expected a scenario');
    expect(scenario.parentId).toBe(plan.id);
    expect(scenario.title).toBe('Night Ferry: add Accra, drop London');
    expect(scenario.tabs.map((t) => t.key)).toContain('changes');
    expect(scenario.changes.length).toBeGreaterThan(0);
    expect(scenario.brief.assumptions.map((a) => a.id)).toContain('a-place-accra');
    expect(whatIf.thread.baseOutputId).toBe(scenario.id);

    // A rival date check: one line per rival, with the safest week chosen.
    const dated = await say(
      'Check rival dates: "Third Mainland" on 2026-12-04 and "Spider-Man: No Way Home" on 2026-12-11.',
    );
    const check = dated.outputs.find((o) => o.kind === 'date');
    if (!check) throw new Error('Expected a date check');
    expect(check.brief.dates.map((d) => d.rival).sort()).toEqual([
      'Spider-Man: No Way Home',
      'Third Mainland',
    ]);
    expect(check.focusIds).toEqual(check.brief.dates.map((d) => d.id));
    expect(check.brief.weeks).toContain(check.brief.chosenDate);
    expect(dated.thread.baseOutputId).toBe(scenario.id);

    // A partner brief: scored against the baseline, drafted, never sent.
    const briefed = await say('Draft a partner brief for "Eko Threads"');
    const partner = briefed.outputs.find((o) => o.kind === 'partner');
    if (!partner) throw new Error('Expected a partner brief');
    expect(partner.brief.partners[0]).toMatchObject({ name: 'Eko Threads', type: 'Brand' });
    expect(partner.brief.partners[0]?.draft).toContain('Hi Eko Threads team');
    expect(partner.receipts.some((r) => r.lineId === partner.focusIds[0])).toBe(true);

    const compared = await request(http())
      .get(`/projects/${projectId}/compare?a=${plan.id}&b=${scenario.id}`)
      .set(viewer)
      .expect(200);
    expect(compared.body.changes.length).toBeGreaterThan(0);
    await request(http())
      .get(`/projects/${projectId}/compare?a=${plan.id}&b=not-an-id`)
      .set(viewer)
      .expect(400);
  });

  it('rejects an answer that is not on the open card', async () => {
    const res = await request(http())
      .post(`/teams/${teamId}/projects`)
      .set(as)
      .send({
        text: 'Launch plan for my film "Night Ferry", a thriller. Comps: "Salt Road".',
        mode: 'build',
        category: 'film',
      })
      .expect(201);
    const { threadId } = res.body as { threadId: string };
    const asked = await settled(threadId);
    const card = asked.items.findLast((i) => i.role === 'question');
    if (card?.role !== 'question') throw new Error('Expected the market question');
    expect(card.question.card).toBe('text');

    await request(http())
      .post(`/threads/${threadId}/messages`)
      .set(as)
      .send({
        kind: 'answer',
        answer: { kind: 'options', questionId: 'film.nope', optionIds: ['x'] },
      })
      .expect(400);
  });
});
