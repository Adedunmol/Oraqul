import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AppliedRule,
  type Role,
  RULE_ENFORCEMENT,
  RULE_FIELD,
  ruleSentence,
  type SavedDefaults,
  type TeamDefaults,
  type TeamRule,
  type TeamRuleKind,
  type TeamRuleValue,
  teamRuleValueSchema,
} from '@oraqul/schema';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { projects, teamRuleOverrides, teamRules, teams, users } from '../db/schema.js';
import { type ActiveRules, compileRules, NO_RULES, same, territoryBlocked } from './compile.js';
import { RULE_EXTRACTOR, type RuleExtractor } from './extract.js';
import { REJECTIONS, screenText } from './screen.js';

type Row = typeof teamRules.$inferSelect;

/** A rule replaces the one before it, as a new version, when a team can only have one of its kind. */
export const OWNER_ONLY = 'Only an owner can set who must approve anything that leaves Oraqul.';

/** A value as one string with its keys in order, so two equal values compare equal after a round trip through jsonb. */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );

const SINGLE: TeamRuleKind[] = ['budget_max', 'approval', 'tone', 'language'];

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

  /** The team's defaults as written, and the rules in force, in plain sentences. */
  async current(teamId: string): Promise<TeamDefaults> {
    const [team] = await this.db
      .select({ text: teams.defaultsText })
      .from(teams)
      .where(eq(teams.id, teamId));
    const rules = (await this.list(teamId)).filter((r) => r.status === 'active');
    return { text: team?.text ?? '', rules };
  }

  /**
   * Saves what the team wrote and makes its rules the ones in force. The text is the source of
   * truth: a rule it still says is kept as it is, a new one is added, and one it no longer says
   * is removed, so editing the words is how a rule changes or goes. Anything not allowed is left
   * out and reported with its reason. Only an owner can change who must approve.
   */
  async save(
    teamId: string,
    userId: string,
    text: string,
    role: Role = 'owner',
  ): Promise<SavedDefaults> {
    const found = text.trim()
      ? await this.extractor.extract(text)
      : { candidates: [], unparsed: [] };
    const before = await this.db
      .select()
      .from(teamRules)
      .where(
        and(
          eq(teamRules.teamId, teamId),
          eq(teamRules.scope, 'team'),
          eq(teamRules.status, 'active'),
        ),
      );
    const keep = new Set<string>();
    const notAccepted: SavedDefaults['notAccepted'] = [];
    for (const c of found.candidates) {
      if (c.rejection) {
        notAccepted.push({ text: c.sourceText, reason: REJECTIONS[c.rejection] });
        continue;
      }
      // Who must approve what leaves Oraqul is the control that constrains editors, so only an owner sets it.
      if (c.value.kind === 'approval' && role !== 'owner') {
        notAccepted.push({ text: c.sourceText, reason: OWNER_ONLY });
        continue;
      }
      const same = before.find(
        (r) => r.kind === c.value.kind && stable(r.value) === stable(c.value),
      );
      if (same) {
        keep.add(same.id);
        continue;
      }
      const row = await this.saveActive(
        {
          teamId,
          scope: 'team',
          projectId: null,
          kind: c.value.kind,
          ...RULE_FIELD[c.value.kind],
          value: c.value,
          enforcement: RULE_ENFORCEMENT[c.value.kind],
          sourceText: c.sourceText,
          createdBy: userId,
        },
        userId,
      );
      if (row) keep.add(row.id);
    }
    // A rule the text no longer says is removed. An editor cannot take away the approver.
    const gone = before.filter(
      (r) => !keep.has(r.id) && !(r.kind === 'approval' && role !== 'owner'),
    );
    for (const r of gone) {
      await this.db
        .update(teamRules)
        .set({ status: 'archived' })
        .where(and(eq(teamRules.id, r.id), eq(teamRules.status, 'active')));
    }
    await this.db.update(teams).set({ defaultsText: text.trim() }).where(eq(teams.id, teamId));
    return { ...(await this.current(teamId)), notAccepted, unparsed: found.unparsed };
  }

  /**
   * Makes a rule active at once. A rule that replaces a single valued one (a ceiling, an approver,
   * a tone, a language) is a new version, and the one before it is archived, so every plan can say
   * which version it ran under.
   */
  private async saveActive(
    base: Omit<typeof teamRules.$inferInsert, 'status' | 'version' | 'supersedesId'>,
    userId: string,
  ): Promise<Row | undefined> {
    return this.db.transaction(async (tx) => {
      let version = 1;
      let supersedes: string | null = null;
      if (SINGLE.includes(base.kind as TeamRuleKind)) {
        const [old] = await tx
          .select()
          .from(teamRules)
          .where(
            and(
              eq(teamRules.teamId, base.teamId),
              eq(teamRules.kind, base.kind),
              eq(teamRules.scope, base.scope ?? 'team'),
              eq(teamRules.status, 'active'),
              base.projectId ? eq(teamRules.projectId, base.projectId) : undefined,
            ),
          );
        if (old) {
          await tx.update(teamRules).set({ status: 'archived' }).where(eq(teamRules.id, old.id));
          version = old.version + 1;
          supersedes = old.id;
        }
      }
      const [row] = await tx
        .insert(teamRules)
        .values({
          ...base,
          status: 'active',
          confirmedBy: userId,
          confirmedAt: new Date(),
          version,
          supersedesId: supersedes,
        })
        .returning();
      return row;
    });
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
