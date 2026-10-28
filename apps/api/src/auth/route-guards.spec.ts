import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import { FundingController } from '../funding/funding.controller.js';
import { GuideController } from '../guide/guide.controller.js';
import { HealthController } from '../health/health.controller.js';
import { McpController } from '../mcp-http/mcp.controller.js';
import { TokenGuard } from '../mcp-http/token.guard.js';
import { TokensController } from '../mcp-http/tokens.controller.js';
import { CalendarController, CalendarFeedController } from '../projects/calendar.controller.js';
import { PinsController } from '../projects/pins.controller.js';
import { ProjectsController } from '../projects/projects.controller.js';
import { SharesController } from '../projects/shares.controller.js';
import { RulesController } from '../rules/rules.controller.js';
import { TeamRulesController } from '../team-rules/team-rules.controller.js';
import { InvitesController } from '../teams/invites.controller.js';
import { TeamsController } from '../teams/teams.controller.js';
import { UploadsController } from '../uploads/uploads.controller.js';
import { AllowanceController } from '../watch/allowance.controller.js';
import { WatchController } from '../watch/watch.controller.js';
import { AuthController } from './auth.controller.js';
import { ROLES_KEY, RolesGuard } from './roles.guard.js';
import { SessionGuard } from './session.guard.js';

// The database has no row-level security: who may read a row is decided in the route guard. So this
// walks every route and fails when one that acts on a team's data could run without it. A new
// controller has to be added here, which is the point: it is a prompt to check its routes.
const controllers: Type[] = [
  AuthController,
  HealthController,
  InvitesController,
  TeamsController,
  UploadsController,
  PinsController,
  ProjectsController,
  SharesController,
  CalendarController,
  CalendarFeedController,
  GuideController,
  RulesController,
  WatchController,
  AllowanceController,
  TeamRulesController,
  FundingController,
  McpController,
  TokensController,
];

// Routes open to someone with no session, on purpose.
const open = new Set([
  'GET health',
  'GET s/:token',
  'GET cal/:token',
  'POST guide/ask',
  'GET rules',
  'POST auth/signup',
  'POST auth/code',
  'POST auth/code/verify',
  'POST auth/login',
  'POST auth/password/reset',
  'POST auth/password/reset/confirm',
  'GET auth/google',
  'GET auth/google/callback',
]);

// The hosted MCP server takes a personal access token, not a session, on every call. A route may
// lack a session guard only if it has the token guard, and only these routes may.
const tokenOnly = new Set(['POST mcp', 'GET mcp', 'DELETE mcp']);

// Routes that name a project but need no role in its team, because they only touch the caller's own
// row: unpinning deletes the caller's pin, so someone who left the team can still tidy up.
const ownRowOnly = new Set(['DELETE me/pins/:projectId']);

// Params that name a team's data. A route with one must check the caller's role in that team.
const TEAM_PARAMS = [':teamId', ':projectId', ':threadId', ':outputId'];

const METHODS: Record<number, string> = { 0: 'GET', 1: 'POST', 2: 'PUT', 3: 'DELETE', 4: 'PATCH' };

interface Route {
  key: string;
  path: string;
  guards: unknown[];
  roles: unknown;
}

function routesOf(controller: Type): Route[] {
  const base: string = Reflect.getMetadata('path', controller) ?? '';
  const classGuards: unknown[] = Reflect.getMetadata('__guards__', controller) ?? [];
  return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    const handler = controller.prototype[name];
    const method = Reflect.getMetadata('method', handler);
    if (method === undefined) return [];
    const sub: string = Reflect.getMetadata('path', handler) ?? '';
    const path = [base, sub].filter((p) => p && p !== '/').join('/');
    const guards = [...classGuards, ...(Reflect.getMetadata('__guards__', handler) ?? [])];
    return [
      {
        key: `${METHODS[method] ?? method} ${path}`,
        path,
        guards,
        roles:
          Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, controller),
      },
    ];
  });
}

const all = controllers.flatMap(routesOf);

describe('route guards', () => {
  it('finds the routes', () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it('puts a session guard on every route that is not open on purpose', () => {
    const unguarded = all.filter(
      (r) =>
        !open.has(r.key) &&
        !r.guards.includes(SessionGuard) &&
        !(tokenOnly.has(r.key) && r.guards.includes(TokenGuard)),
    );
    expect(unguarded.map((r) => r.key)).toEqual([]);
  });

  it('checks the role in the team on every route that names a team, project, thread or output', () => {
    const missing = all.filter(
      (r) =>
        !ownRowOnly.has(r.key) &&
        TEAM_PARAMS.some((p) => r.path.includes(p)) &&
        !(r.guards.includes(RolesGuard) && Array.isArray(r.roles) && r.roles.length > 0),
    );
    expect(missing.map((r) => r.key)).toEqual([]);
  });

  it('keeps the token routes to the MCP server, each with the token guard and none with a session', () => {
    const tokened = all.filter((r) => r.guards.includes(TokenGuard)).map((r) => r.key);
    expect(tokened.sort()).toEqual([...tokenOnly].sort());
    expect(all.filter((r) => tokenOnly.has(r.key) && r.guards.includes(SessionGuard))).toEqual([]);
  });

  it('keeps the open routes to the list above', () => {
    const seen = all
      .filter((r) => !r.guards.includes(SessionGuard) && !tokenOnly.has(r.key))
      .map((r) => r.key);
    expect(seen.sort()).toEqual([...open].filter((k) => seen.includes(k)).sort());
  });
});
