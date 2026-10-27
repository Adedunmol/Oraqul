import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PACE_RULES, PACE_VERSION } from '@oraqul/packs';
import {
  type ActualRow,
  type ActualsPreview,
  type LaunchPlan,
  launchPlanSchema,
  type PaceSettings,
  type PaceState,
  paceSettingsSchema,
  type UpdatePaceBody,
} from '@oraqul/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { releaseOf } from '../agent/launch/campaign.js';
import { paceOf } from '../agent/launch/pace.js';
import { type Database, DB } from '../db/db.module.js';
import { actuals, outputs, paceSettings, projects } from '../db/schema.js';
import { parseActuals } from './actuals-parse.js';

const curveSchema = paceSettingsSchema.shape.curve;
const today = () => new Date().toISOString().slice(0, 10);

interface Loaded {
  projectId: string;
  category: 'film' | 'music' | 'books' | 'podcasts' | 'games' | 'shows' | null;
  plan: LaunchPlan | null;
}

/**
 * The team's own figures against a plan's one signal (spec §5.18). Code reads the figures; the
 * model is never involved, and nothing here is sent to Qloo.
 */
@Injectable()
export class PaceService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async load(outputId: string): Promise<Loaded> {
    const [row] = await this.db
      .select({ plan: outputs.plan, projectId: outputs.projectId, category: projects.category })
      .from(outputs)
      .innerJoin(projects, eq(projects.id, outputs.projectId))
      .where(eq(outputs.id, outputId))
      .limit(1);
    if (!row) throw new NotFoundException('No such output');
    const plan = launchPlanSchema.safeParse(row.plan);
    return {
      projectId: row.projectId,
      category: row.category,
      plan: plan.success ? plan.data : null,
    };
  }

  /** What a plan's figures are read against: the saved settings, else the rule's defaults. */
  private defaults(loaded: Loaded): PaceSettings | null {
    const { plan, category } = loaded;
    if (!plan?.signal || !category) return null;
    const rule = PACE_RULES[category].value;
    return {
      target: plan.signal.target?.value ?? null,
      unit: plan.signal.target?.unit ?? plan.signal.primary,
      kind: rule.kind,
      entry: rule.entry,
      curve: rule.curve,
      curveFrom: 'rule',
      rulesVersion: PACE_VERSION,
    };
  }

  async settings(outputId: string): Promise<PaceSettings | null> {
    const loaded = await this.load(outputId);
    const [saved] = await this.db
      .select()
      .from(paceSettings)
      .where(eq(paceSettings.outputId, outputId))
      .limit(1);
    const base = this.defaults(loaded);
    if (!saved || !base) return base;
    const curve = curveSchema.safeParse(saved.curve);
    return {
      target: saved.target,
      unit: saved.unit,
      kind: saved.kind,
      entry: saved.entry,
      curve: curve.success ? curve.data : base.curve,
      curveFrom: saved.curveFrom,
      rulesVersion: saved.rulesVersion,
    };
  }

  async state(outputId: string, now: string = today()): Promise<PaceState> {
    const loaded = await this.load(outputId);
    const settings = await this.settings(outputId);
    const entries = await this.db
      .select()
      .from(actuals)
      .where(eq(actuals.outputId, outputId))
      .orderBy(asc(actuals.onDate), asc(actuals.city));
    const release = loaded.plan ? releaseOf(loaded.plan.calendar) : null;
    const signal = loaded.plan?.signal?.primary ?? '';
    const none = (reason: string): PaceState => ({
      available: false,
      unavailableReason: reason,
      signal,
      settings,
      entries: [],
      result: null,
      releaseDate: release,
      canRescue: false,
    });
    if (!loaded.plan) return none('Only a launch plan can be paced.');
    if (!settings) return none('This plan has no signal to read figures against.');
    if (!release) {
      return none('This plan has no release date, so figures have nothing to be read against.');
    }
    const list = entries.map((e) => ({
      id: e.id,
      onDate: e.onDate,
      value: e.value,
      city: e.city,
      channel: e.channel,
    }));
    const result = paceOf({
      settings,
      checkpoints: loaded.plan.signal?.checkpoints ?? [],
      releaseDate: release,
      entries: list,
      today: now,
    });
    return {
      available: true,
      unavailableReason: null,
      signal,
      settings,
      entries: list,
      result,
      releaseDate: release,
      canRescue: result.verdict === 'behind',
    };
  }

  preview(text: string, mapping: ActualsPreview['mapping']): ActualsPreview {
    return parseActuals(text, mapping);
  }

  async save(outputId: string, userId: string, rows: ActualRow[]): Promise<void> {
    const loaded = await this.load(outputId);
    const key = loaded.plan?.signal?.key;
    if (!key) throw new NotFoundException('This plan has no signal to record figures for');
    await this.db
      .insert(actuals)
      .values(
        rows.map((r) => ({
          outputId,
          projectId: loaded.projectId,
          signalKey: key,
          onDate: r.onDate,
          value: r.value,
          city: r.city.trim(),
          channel: r.channel.trim(),
          createdBy: userId,
        })),
      )
      .onConflictDoUpdate({
        target: [actuals.outputId, actuals.onDate, actuals.city, actuals.channel],
        set: { value: sql`excluded.value`, createdBy: userId },
      });
  }

  async remove(outputId: string, actualId: string): Promise<void> {
    await this.db
      .delete(actuals)
      .where(and(eq(actuals.outputId, outputId), eq(actuals.id, actualId)));
  }

  async update(outputId: string, patch: UpdatePaceBody): Promise<PaceState> {
    const loaded = await this.load(outputId);
    const current = await this.settings(outputId);
    if (!current) throw new NotFoundException('This plan has no signal to pace');
    const base = this.defaults(loaded) ?? current;
    const next: PaceSettings = {
      ...current,
      ...(patch.target !== undefined ? { target: patch.target } : {}),
      ...(patch.entry ? { entry: patch.entry } : {}),
      ...(patch.curve ? { curve: patch.curve, curveFrom: 'team' as const } : {}),
      ...(patch.resetCurve ? { curve: base.curve, curveFrom: 'rule' as const } : {}),
    };
    const values = {
      target: next.target,
      unit: next.unit,
      kind: next.kind,
      entry: next.entry,
      curve: next.curve,
      curveFrom: next.curveFrom,
      rulesVersion: next.rulesVersion,
      updatedAt: new Date(),
    };
    await this.db
      .insert(paceSettings)
      .values({ outputId, ...values })
      .onConflictDoUpdate({ target: paceSettings.outputId, set: values });
    return this.state(outputId);
  }
}
