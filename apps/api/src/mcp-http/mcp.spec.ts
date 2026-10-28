import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { type ExecutionContext, HttpException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type OutputDetail, outputDetailSchema, type WatchState } from '@oraqul/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RunCapsService } from '../agent/run-caps.js';
import { apiTokens, memberships, runs, teams, users } from '../db/schema.js';
import { calendarRow, planWith, seedProject } from '../test-support/seed.js';
import { McpService } from './mcp.service.js';
import { planSummary, watchSummary } from './summary.js';
import { type McpRequest, TokenGuard } from './token.guard.js';
import { CALLS_PER_MINUTE, RUNS_PER_HOUR, TokenLimiter } from './token-limiter.js';
import { type Principal, TokensService } from './tokens.service.js';

const example: OutputDetail = outputDetailSchema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../test/fixtures/demo-film-output.json', import.meta.url)),
      'utf8',
    ),
  ),
);

// Keys and words that mean raw Qloo data, a receipt or a call. None may appear in any answer.
const RAW_KEYS = [
  'input',
  'returned',
  'receipts',
  'receipt',
  'callIds',
  'callId',
  'endpoint',
  'affinity',
  'numbers',
  'entityId',
];
function keysOf(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) keysOf(v, out);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysOf(v, out);
    }
  }
  return out;
}

describe('tokens', () => {
  let seed: Awaited<ReturnType<typeof seedProject>>;
  let tokens: TokensService;
  beforeAll(async () => {
    seed = await seedProject();
    await seed.db
      .insert(memberships)
      .values({ teamId: seed.teamId, userId: seed.userId, role: 'editor' });
    await seed.db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, seed.userId));
    tokens = new TokensService(seed.db);
  });
  afterAll(() => seed.database.close());

  it('shows a token once, stores only its hash, and authenticates it as the person in their team', async () => {
    const created = await tokens.create(seed.userId, seed.teamId, {
      name: 'Claude',
      expiresInDays: 30,
    });
    expect(created.token).toMatch(/^oraq_[A-Za-z0-9_-]{40,}$/);
    expect(created.record.prefix).toBe(created.token.slice(0, 9));
    const rows = await seed.db.select().from(apiTokens);
    expect(JSON.stringify(rows)).not.toContain(created.token);
    expect(await tokens.authenticate(created.token)).toMatchObject({
      userId: seed.userId,
      teamId: seed.teamId,
      role: 'editor',
      emailVerified: true,
    });
    expect((await tokens.list(seed.userId, seed.teamId))[0]?.lastUsedAt).not.toBeNull();
    expect(await tokens.authenticate('oraq_wrong')).toBeNull();
    expect(JSON.stringify(await tokens.list(seed.userId, seed.teamId))).not.toContain(
      created.token,
    );
  });

  it('stops working at once when revoked, expired, or the person leaves or changes role', async () => {
    const a = await tokens.create(seed.userId, seed.teamId, { name: 'a', expiresInDays: 30 });
    await tokens.revoke(seed.userId, seed.teamId, a.record.id);
    expect(await tokens.authenticate(a.token)).toBeNull();

    const b = await tokens.create(
      seed.userId,
      seed.teamId,
      { name: 'b', expiresInDays: 30 },
      new Date('2020-01-01'),
    );
    expect(await tokens.authenticate(b.token)).toBeNull();

    const c = await tokens.create(seed.userId, seed.teamId, { name: 'c', expiresInDays: 365 });
    await seed.db
      .update(memberships)
      .set({ role: 'viewer' })
      .where(eq(memberships.userId, seed.userId));
    expect((await tokens.authenticate(c.token))?.role).toBe('viewer');
    await seed.db.delete(memberships).where(eq(memberships.userId, seed.userId));
    expect(await tokens.authenticate(c.token)).toBeNull();
    await seed.db
      .insert(memberships)
      .values({ teamId: seed.teamId, userId: seed.userId, role: 'editor' });
  });

  it('lets a person revoke only their own tokens', async () => {
    const mine = await tokens.create(seed.userId, seed.teamId, { name: 'mine', expiresInDays: 30 });
    await expect(
      tokens.revoke('00000000-0000-4000-8000-000000000999', seed.teamId, mine.record.id),
    ).rejects.toThrow('No such token');
    await expect(tokens.revoke(seed.userId, seed.teamId, mine.record.id)).resolves.toBeDefined();
  });

  it('guards a call: no token, a wrong token and a revoked token are 401, a good one passes', async () => {
    const guard = new TokenGuard(tokens, new TokenLimiter());
    const ctx = (authorization?: string) => {
      const request = { headers: { authorization } } as unknown as McpRequest;
      return {
        request,
        ctx: { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext,
      };
    };
    for (const h of [
      undefined,
      'Bearer nope',
      'Basic abc',
      'Bearer oraq_aaaaaaaaaaaaaaaaaaaaaaaa',
    ]) {
      await expect(guard.canActivate(ctx(h).ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    }
    const t = await tokens.create(seed.userId, seed.teamId, { name: 'g', expiresInDays: 30 });
    const good = ctx(`Bearer ${t.token}`);
    expect(await guard.canActivate(good.ctx)).toBe(true);
    expect(good.request.principal.userId).toBe(seed.userId);
    await tokens.revoke(seed.userId, seed.teamId, t.record.id);
    await expect(guard.canActivate(ctx(`Bearer ${t.token}`).ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('limits calls a minute, with a 429', async () => {
    const guard = new TokenGuard(tokens, new TokenLimiter());
    const t = await tokens.create(seed.userId, seed.teamId, { name: 'r', expiresInDays: 30 });
    const call = () =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization: `Bearer ${t.token}` } }),
        }),
      } as unknown as ExecutionContext);
    for (let i = 0; i < CALLS_PER_MINUTE; i++) await call();
    await expect(call()).rejects.toMatchObject({ status: 429 });
    await expect(call()).rejects.toBeInstanceOf(HttpException);
  });
});

describe('TokenLimiter', () => {
  it('counts runs an hour and frees them as the window passes', () => {
    const limiter = new TokenLimiter();
    for (let i = 0; i < RUNS_PER_HOUR; i++) expect(limiter.take('t', 'run', 1000 + i)).toBe(true);
    expect(limiter.take('t', 'run', 2000)).toBe(false);
    expect(limiter.take('other', 'run', 2000)).toBe(true);
    expect(limiter.take('t', 'run', 1000 + 60 * 60_000 + 1)).toBe(true);
  });
});

describe('the hosted MCP tools', () => {
  let seed: Awaited<ReturnType<typeof seedProject>>;
  let other: { teamId: string; projectId: string };
  let outputId = '';
  const started: { args: unknown[] }[] = [];
  const posted: { threadId: string; text: string; origin: unknown }[] = [];

  const watchState = {
    outputId: '00000000-0000-4000-8000-000000000001',
    status: 'active',
    cadence: 'daily',
    minSeverity: 'watch',
    lastCheckedAt: '2026-10-27T08:00:00.000Z',
    nextCheckAt: null,
    notes: [],
    muted: false,
    unread: 0,
    watchable: true,
    events: [
      {
        id: '00000000-0000-4000-8000-000000000002',
        type: 'rival_date',
        severity: 'watch',
        title: 'Salt Road 2 opens 2027-03-09',
        reason: 'A page says so. The date is from the web.',
        evidence: [
          { url: 'https://x.example', title: 'X', retrievedAt: '2026-10-27', quote: 'raw words' },
        ],
        status: 'open',
        actionOutputId: null,
        createdAt: '2026-10-27T08:00:00.000Z',
        seen: false,
      },
    ],
    pace: {
      available: false,
      unavailableReason: 'x',
      signal: '',
      settings: null,
      entries: [],
      result: null,
      releaseDate: null,
      canRescue: false,
    },
  } as unknown as WatchState;

  const service = (p: { db: typeof seed.db }) =>
    new McpService(
      p.db,
      {
        list: async () => [
          {
            id: seed.projectId,
            name: 'Night Ferry',
            category: 'film',
            status: 'active',
            updatedAt: '2026-10-01T00:00:00.000Z',
          },
        ],
        outputDetail: async () => example,
        threadDetail: async () => ({
          busy: false,
          items: [
            {
              id: 'q',
              role: 'question',
              question: {
                id: 'film.band',
                card: 'single',
                prompt: 'What band?',
                options: [{ id: 'micro', label: 'Micro' }],
              },
              answer: null,
            },
            { id: 'a', role: 'agent', text: 'Which band?' },
          ],
          projectOutputs: [example.output],
        }),
      } as never,
      {
        createProject: async (...args: unknown[]) => {
          started.push({ args });
          return { projectId: seed.projectId, threadId: seed.threadId };
        },
        post: async (threadId: string, body: { text: string }, origin: unknown) => {
          posted.push({ threadId, text: body.text, origin });
        },
      } as never,
      new RunCapsService(p.db, new ConfigService({ RUN_CAP_PER_USER_MONTH: 2 }) as never),
      { forProject: async () => [], currentPlanId: () => outputId } as never,
      { state: async () => watchState } as never,
      new TokenLimiter(),
    );

  const principal = (over: Partial<Principal> = {}): Principal => ({
    tokenId: '00000000-0000-4000-8000-0000000000aa',
    userId: seed.userId,
    teamId: seed.teamId,
    role: 'editor',
    emailVerified: true,
    ...over,
  });

  async function connect(p: Principal, svc = service({ db: seed.db })) {
    const server = svc.serverFor(p);
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([server.connect(a), client.connect(b)]);
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { text: string }[])[0]?.text ?? '';
      return { isError: Boolean(result.isError), text };
    };
    return { client, call };
  }

  beforeAll(async () => {
    seed = await seedProject();
    outputId = await seed.save({
      plan: planWith([calendarRow('launch', 0, '2099-03-12', 'post')]),
    });
    const [team] = await seed.db.insert(teams).values({ name: 'Other' }).returning();
    other = { teamId: team?.id ?? '', projectId: '' };
  });
  afterAll(() => seed.database.close());

  it('offers the plan pipeline and nothing that sends, confirms a send, changes rules or makes tokens', async () => {
    const { client } = await connect(principal());
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'oraqul_answer_question',
      'oraqul_audit_plan',
      'oraqul_build_plan',
      'oraqul_fix_plan',
      'oraqul_get_plan',
      'oraqul_get_run_status',
      'oraqul_get_watch_events',
      'oraqul_list_projects',
    ]);
    expect(names.join(' ')).not.toMatch(
      /send|sent|confirm|handoff|rule|token|qloo(?!_)|search|lift|rank/i,
    );
    for (const t of (await client.listTools()).tools) {
      expect(t.description?.length).toBeGreaterThan(40);
      expect(t.inputSchema.type).toBe('object');
    }
  });

  it('starts a build as a run from MCP and returns a run id at once', async () => {
    const { call } = await connect(principal());
    const out = await call('oraqul_build_plan', {
      text: 'Launch plan for "Night Ferry", a Nigerian thriller film opening in Lagos and London.',
      budget_band: 'independent',
      platforms: ['Instagram', 'TikTok'],
    });
    expect(out.isError).toBe(false);
    expect(JSON.parse(out.text)).toEqual({
      run_id: seed.threadId,
      project_id: seed.projectId,
      status: 'running',
    });
    const args = started.at(-1)?.args as [string, string, { text: string; mode: string }, string];
    expect(args[3]).toBe('mcp');
    expect(args[2].text).toContain('An independent budget.');
    expect(args[2].text).toContain('Channels we already use: Instagram, TikTok.');
    expect(args[2].mode).toBe('build');
  });

  it('refuses an input it does not know, a bad one, and both or neither of two choices', async () => {
    const { call } = await connect(principal());
    const text = 'Launch plan for "Night Ferry", a Nigerian thriller film opening in Lagos.';
    expect((await call('oraqul_build_plan', { text, extra: 'x' })).isError).toBe(true);
    expect((await call('oraqul_build_plan', { text: 'short' })).isError).toBe(true);
    expect((await call('oraqul_build_plan', { text, budget_band: 'huge' })).isError).toBe(true);
    expect((await call('oraqul_get_plan', {})).isError).toBe(true);
    expect((await call('oraqul_audit_plan', {})).isError).toBe(true);
  });

  it('keeps a viewer to reading, and acts only inside the token’s team', async () => {
    const viewer = await connect(principal({ role: 'viewer' }));
    const build = await viewer.call('oraqul_build_plan', {
      text: 'Launch plan for "Night Ferry", a Nigerian thriller film in Lagos.',
    });
    expect(build).toMatchObject({ isError: true });
    expect(build.text).toContain('does not allow that');
    expect((await viewer.call('oraqul_list_projects')).isError).toBe(false);

    const elsewhere = await connect(principal({ teamId: other.teamId }));
    const missing = await elsewhere.call('oraqul_get_run_status', { run_id: seed.threadId });
    const nobody = await elsewhere.call('oraqul_get_run_status', {
      run_id: '00000000-0000-4000-8000-0000000000ff',
    });
    expect(missing).toEqual({ isError: true, text: 'No such run in this team.' });
    expect(nobody).toEqual(missing);
    expect((await elsewhere.call('oraqul_get_plan', { output_id: outputId })).text).toBe(
      'No such output in this team.',
    );
    expect(
      (await elsewhere.call('oraqul_get_watch_events', { project_id: seed.projectId })).text,
    ).toBe('No such project in this team.');
  });

  it('stops a run with a clear error when the person has used this month’s runs', async () => {
    await seed.db.insert(runs).values([
      { threadId: seed.threadId, agent: 'film', userId: seed.userId, qlooCalls: 20 },
      { threadId: seed.threadId, agent: 'film', userId: seed.userId, qlooCalls: 30 },
    ]);
    const { call } = await connect(principal());
    const out = await call('oraqul_build_plan', {
      text: 'Launch plan for "Night Ferry", a Nigerian thriller film in Lagos.',
    });
    expect(out.isError).toBe(true);
    expect(out.text).toMatch(/You have used this month's 2 runs\. They reset on \d{4}-\d{2}-01\./);
  });

  it('answers a card as the person, from MCP, and reports where the run stands', async () => {
    const { call } = await connect(principal());
    const status = JSON.parse(
      (await call('oraqul_get_run_status', { run_id: seed.threadId })).text,
    );
    expect(status).toMatchObject({
      status: 'waiting',
      question: { prompt: 'What band?', options: [{ id: 'micro', label: 'Micro' }] },
      message: 'Which band?',
    });
    await call('oraqul_answer_question', { run_id: seed.threadId, answer: 'Micro' });
    expect(posted.at(-1)).toEqual({
      threadId: seed.threadId,
      text: 'Micro',
      origin: { userId: seed.userId, via: 'mcp' },
    });
  });

  it('never returns raw Qloo data, receipts, call ids or endpoints, from any tool', async () => {
    const { call } = await connect(principal());
    const answers = [
      await call('oraqul_get_plan', { output_id: outputId }),
      await call('oraqul_get_plan', { project_id: seed.projectId }),
      await call('oraqul_get_watch_events', { output_id: outputId }),
      await call('oraqul_get_run_status', { run_id: seed.threadId }),
      await call('oraqul_list_projects'),
    ];
    for (const a of answers) {
      expect(a.isError).toBe(false);
      const parsed = JSON.parse(a.text);
      const keys = keysOf(parsed);
      for (const bad of RAW_KEYS)
        expect(keys.has(bad), `${bad} in ${a.text.slice(0, 80)}`).toBe(false);
      expect(a.text).not.toMatch(/\/v2\/|\/search|DEMO-|urn:|"returned"|"input"/);
    }
    const plan = JSON.parse(answers[0]?.text ?? '{}');
    expect(plan.sections.length).toBeGreaterThan(0);
    expect(plan.findings.length).toBeGreaterThan(0);
    expect(Object.keys(plan.findings[0]).sort()).toEqual([
      'confidence',
      'id',
      'names',
      'text',
      'verdict',
    ]);
  });
});

describe('the summaries', () => {
  it('say what the share link says and less: the example has receipts and the summary has none', () => {
    expect(example.output.receipts.length).toBeGreaterThan(0);
    const s = planSummary(example);
    expect(keysOf(s).has('receipts')).toBe(false);
    expect(JSON.stringify(s)).not.toContain(example.output.receipts[0]?.callId ?? 'x');
    expect(s.sections.some((x) => x.key === 'gaps')).toBe(false);
  });

  it('keep a watch event’s page and day read, and leave out the words copied from it', () => {
    const state = JSON.parse(
      JSON.stringify({
        outputId: 'a',
        status: 'active',
        lastCheckedAt: null,
        notes: [],
        events: [
          {
            id: 'e',
            type: 'x',
            severity: 'watch',
            status: 'open',
            title: 't',
            reason: 'r',
            createdAt: 'c',
            evidence: [
              { url: 'https://x', title: 'X', retrievedAt: '2026-10-27', quote: 'copied words' },
            ],
          },
        ],
        pace: { result: null },
      }),
    );
    const s = watchSummary(state);
    expect(s.events[0]?.evidence).toEqual([
      { url: 'https://x', title: 'X', retrievedAt: '2026-10-27' },
    ]);
  });
});
