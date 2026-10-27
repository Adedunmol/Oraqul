import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AppliedRule,
  type ExtractRulesInput,
  RULE_ENFORCEMENT,
  RULE_FIELD,
  ruleSentence,
  type TeamRule,
  type TeamRuleKind,
  type TeamRuleValue,
  teamRuleValueSchema,
} from '@oraqul/schema';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { projects, teamRuleOverrides, teamRules, users } from '../db/schema.js';
import { type ActiveRules, compileRules, NO_RULES, same, territoryBlocked } from './compile.js';
import { RULE_EXTRACTOR, type RuleExtractor } from './extract.js';
import { REJECTIONS, screenText } from './screen.js';

type Row = typeof teamRules.$inferSelect;

/** A rule replaces the one before it, as a new version, when a team can only have one of its kind. */
const SINGLE: TeamRuleKind[] = ['budget_max', 'approval', 'tone', 'language'];

export interface Extracted {
  rules: TeamRule[];
  /** Lines nothing could be made of. */
  unparsed: string[];
}

/**
 * The team's defaults (spec §5.21). Anyone who can run the agent may propose rules from pasted
 * text; only an owner makes one active, and every rule is screened in code so no rule can change
 * what Oraqul reports, how it runs, or who it excludes.
 */
@Injectable()
export class TeamRulesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(RULE_EXTRACTOR) private readonly extractor: RuleExtractor,
  ) {}

  private view(row: Row, by: string | null, conflicts: string[]): TeamRule {
    const value = teamRuleValueSchema.parse(row.value);
    return {
      id: row.id,
      teamId: row.teamId,
      scope: row.scope,
      projectId: row.projectId,
      kind: row.kind,
      field: row.field,
      operator: row.operator,
      value,
      enforcement: row.enforcement,
      sourceText: row.sourceText,
      status: row.status,
      rejectionReason: row.rejectionReason,
      createdBy: row.createdBy,
      createdByName: by,
      confirmedBy: row.confirmedBy,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      version: row.version,
      supersedesId: row.supersedesId,
      createdAt: row.createdAt.toISOString(),
      sentence: ruleSentence(value),
      conflicts,
    };
  }

  /** Every rule of the team, newest first, with what each clashes with. */
  async list(teamId: string): Promise<TeamRule[]> {
    const rows = await this.db
      .select({ row: teamRules, by: users.name })
      .from(teamRules)
      .leftJoin(users, eq(users.id, teamRules.createdBy))
      .where(eq(teamRules.teamId, teamId))
      .orderBy(desc(teamRules.createdAt));
    const places = await this.projectPlaces(teamId);
    const live = rows.filter(({ row }) => row.status === 'active' || row.status === 'proposed');
    return rows.map(({ row, by }) => {
      const open = row.status === 'active' || row.status === 'proposed';
      const conflicts = open
        ? this.conflictsOf(
            row,
            live.map((l) => l.row),
            places,
          )
        : [];
      return this.view(row, by, conflicts);
    });
  }

  private async projectPlaces(teamId: string): Promise<{ name: string; places: string[] }[]> {
    const rows = await this.db
      .select({ name: projects.name, places: projects.places })
      .from(projects)
      .where(and(eq(projects.teamId, teamId), ne(projects.status, 'intake')));
    return rows.flatMap((r) => (r.name ? [{ name: r.name, places: r.places }] : []));
  }

  private conflictsOf(
    row: Row,
    others: Row[],
    places: { name: string; places: string[] }[],
  ): string[] {
    const value = teamRuleValueSchema.safeParse(row.value);
    if (!value.success) return [];
    const v = value.data;
    const out: string[] = [];
    const rest = others.filter((o) => o.id !== row.id && o.kind !== undefined);
    const valuesOf = (kind: TeamRuleKind) =>
      rest
        .filter((o) => o.kind === kind)
        .flatMap((o) => {
          const p = teamRuleValueSchema.safeParse(o.value);
          return p.success ? [p.data] : [];
        });
    if (v.kind === 'budget_max') {
      for (const o of valuesOf('budget_max')) {
        if (o.kind === 'budget_max' && o.amount !== v.amount) {
          out.push(
            `Another ceiling is ${o.currency} ${o.amount.toLocaleString('en-US')}. The lower one applies.`,
          );
        }
      }
    }
    if (v.kind === 'approval') {
      for (const o of valuesOf('approval')) {
        if (o.kind === 'approval' && o.role !== v.role) {
          out.push('Another approval rule names a different role. The stricter one applies.');
        }
      }
    }
    if (v.kind === 'territory_allow' || v.kind === 'territory_block') {
      const other = valuesOf(v.kind === 'territory_allow' ? 'territory_block' : 'territory_allow');
      for (const o of other) {
        if (o.kind !== 'territory_allow' && o.kind !== 'territory_block') continue;
        const clash = v.names.filter((n) => o.names.some((x) => same(x, n)));
        if (v.kind === 'territory_allow' && o.kind === 'territory_block' && clash.length) {
          out.push(`${clash.join(', ')} is allowed here and blocked by another rule.`);
        }
        if (v.kind === 'territory_block' && o.kind === 'territory_allow' && clash.length) {
          out.push(`${clash.join(', ')} is blocked here and allowed by another rule.`);
        }
      }
      const check: ActiveRules = {
        ...NO_RULES,
        blockedTerritories: v.kind === 'territory_block' ? v.names : [],
        allowedTerritories: v.kind === 'territory_allow' ? v.names : null,
      };
      for (const p of places) {
        const hit = p.places.filter((place) => territoryBlocked(check, place));
        if (hit.length) out.push(`The project “${p.name}” names ${hit.join(', ')}.`);
      }
    }
    return out;
  }

  /** Reads pasted text into proposed rules. A rule that is not allowed is saved rejected, with why. */
  async extract(teamId: string, userId: string, input: ExtractRulesInput): Promise<Extracted> {
    const scope = input.scope ?? 'team';
    const projectId = input.projectId ?? null;
    if (scope === 'project') {
      const [project] = projectId
        ? await this.db
            .select({ id: projects.id })
            .from(projects)
            .where(and(eq(projects.id, projectId), eq(projects.teamId, teamId)))
        : [];
      if (!project) throw new BadRequestException('A project rule needs a project of this team.');
    }
    const found = await this.extractor.extract(input.text);
    const made: Row[] = [];
    for (const c of found.candidates) {
      const [row] = await this.db
        .insert(teamRules)
        .values({
          teamId,
          scope,
          projectId: scope === 'project' ? projectId : null,
          kind: c.value.kind,
          ...RULE_FIELD[c.value.kind],
          value: c.value,
          enforcement: RULE_ENFORCEMENT[c.value.kind],
          sourceText: c.sourceText,
          status: c.rejection ? 'rejected' : 'proposed',
          rejectionReason: c.rejection ? REJECTIONS[c.rejection] : null,
          createdBy: userId,
        })
        .returning();
      if (row) made.push(row);
    }
    const all = await this.list(teamId);
    const ids = new Set(made.map((m) => m.id));
    return { rules: all.filter((r) => ids.has(r.id)), unparsed: found.unparsed };
  }

  private async proposed(teamId: string, ruleId: string): Promise<Row> {
    const [row] = await this.db
      .select()
      .from(teamRules)
      .where(and(eq(teamRules.id, ruleId), eq(teamRules.teamId, teamId)));
    if (!row) throw new NotFoundException('No such rule');
    if (row.status !== 'proposed')
      throw new ConflictException('That rule is not waiting to be confirmed');
    return row;
  }

  /** Makes a proposed rule active. A single valued rule replaces the one before it as a new version. */
  async confirm(teamId: string, ruleId: string, userId: string): Promise<TeamRule[]> {
    const row = await this.proposed(teamId, ruleId);
    // Screened again here, not only when it was read, so a rule never goes live on one check.
    const value = teamRuleValueSchema.parse(row.value);
    const why = screenText(row.sourceText) ?? screenText(ruleSentence(value));
    if (why) throw new BadRequestException(REJECTIONS[why]);
    await this.db.transaction(async (tx) => {
      let version = 1;
      let supersedes: string | null = null;
      if (SINGLE.includes(row.kind)) {
        const [old] = await tx
          .select()
          .from(teamRules)
          .where(
            and(
              eq(teamRules.teamId, teamId),
              eq(teamRules.kind, row.kind),
              eq(teamRules.scope, row.scope),
              eq(teamRules.status, 'active'),
              row.projectId ? eq(teamRules.projectId, row.projectId) : undefined,
            ),
          );
        if (old) {
          await tx.update(teamRules).set({ status: 'archived' }).where(eq(teamRules.id, old.id));
          version = old.version + 1;
          supersedes = old.id;
        }
      }
      await tx
        .update(teamRules)
        .set({
          status: 'active',
          confirmedBy: userId,
          confirmedAt: new Date(),
          version,
          supersedesId: supersedes,
        })
        .where(eq(teamRules.id, ruleId));
    });
    return this.list(teamId);
  }

  async reject(teamId: string, ruleId: string, reason: string): Promise<TeamRule[]> {
    await this.proposed(teamId, ruleId);
    await this.db
      .update(teamRules)
      .set({ status: 'rejected', rejectionReason: reason })
      .where(eq(teamRules.id, ruleId));
    return this.list(teamId);
  }

  async archive(teamId: string, ruleId: string): Promise<TeamRule[]> {
    const [row] = await this.db
      .select({ status: teamRules.status })
      .from(teamRules)
      .where(and(eq(teamRules.id, ruleId), eq(teamRules.teamId, teamId)));
    if (!row) throw new NotFoundException('No such rule');
    if (row.status !== 'active') throw new ConflictException('Only an active rule can be archived');
    await this.db.update(teamRules).set({ status: 'archived' }).where(eq(teamRules.id, ruleId));
    return this.list(teamId);
  }

  /** The active rules a run follows: the team's, and those of its project. */
  async forRun(teamId: string, projectId: string | null): Promise<ActiveRules> {
    const rows = await this.db
      .select({ row: teamRules, by: users.name })
      .from(teamRules)
      .leftJoin(users, eq(users.id, teamRules.createdBy))
      .where(and(eq(teamRules.teamId, teamId), eq(teamRules.status, 'active')));
    const mine = rows.filter(
      ({ row }) => row.scope === 'team' || (projectId !== null && row.projectId === projectId),
    );
    if (mine.length === 0) return NO_RULES;
    return compileRules(mine.map(({ row, by }) => this.view(row, by, [])));
  }

  /** A person went ahead against a rule for this run. Logged against the rule and its version. */
  async logOverride(
    threadId: string,
    userId: string | null,
    applied: AppliedRule[],
  ): Promise<void> {
    if (applied.length === 0) return;
    await this.db
      .insert(teamRuleOverrides)
      .values(applied.map((r) => ({ ruleId: r.id, ruleVersion: r.version, threadId, userId })));
  }

  async overrides(teamId: string): Promise<{ ruleId: string; threadId: string; at: string }[]> {
    const ids = (
      await this.db.select({ id: teamRules.id }).from(teamRules).where(eq(teamRules.teamId, teamId))
    ).map((r) => r.id);
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(teamRuleOverrides)
      .where(inArray(teamRuleOverrides.ruleId, ids))
      .orderBy(desc(teamRuleOverrides.createdAt));
    return rows.map((r) => ({
      ruleId: r.ruleId,
      threadId: r.threadId,
      at: r.createdAt.toISOString(),
    }));
  }
}

export type { TeamRuleValue };
