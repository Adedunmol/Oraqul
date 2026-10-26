import { QlooBudgetError } from '@oraqul/engine';
import type { Output, RefreshReport } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import type { LaunchDeps } from './config.js';
import type { Change } from './follow-up.js';
import {
  applyChange,
  askQloo,
  findComps,
  type LaunchInputs,
  type PlanRun,
  runCtx,
} from './pipeline.js';
import type { QueryPlanCore } from './planner.js';
import type { LaunchRead } from './read-core.js';
import { affectedLines, compareFindings, compareSources } from './refresh-compare.js';

const NO_CHANGE: Change = {
  addPlaces: [],
  dropPlaces: [],
  addComps: [],
  dropComps: [],
  addCollabs: [],
  ages: [],
  gender: null,
};

const REFRESH_STEPS = 4;
const MAX_QUESTION = 200;

/**
 * The person's question with the work's title taken out, so an unreleased name never reaches a
 * search. A plain request to check ("Check what has changed") asks nothing in particular, so only
 * a message that is a question counts.
 */
export function questionFor(text: string, title: string): string | null {
  const asked = text.trim().slice(0, MAX_QUESTION);
  if (!/\?\s*$|^(?:has|have|did|is|are|was|were|when|what|which|who|how|do|does)\b/i.test(asked)) {
    return null;
  }
  return asked.replaceAll(
    new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
    'the release',
  );
}

/**
 * Checks what has changed since a saved plan was made. Qloo and the web are asked again with the
 * plan's own brief, and every difference is worked out by code against what the plan saved. The
 * plan is not touched; a revision is saved only when the person asks for one (spec §5.16).
 */
export async function runRefresh<R extends LaunchRead, P extends QueryPlanCore>(
  handoff: Handoff,
  deps: LaunchDeps<R, P>,
  plan: Output,
  inputs: LaunchInputs<R>,
): Promise<PlanRun> {
  const saved = plan.plan;
  if (!saved) {
    deps.emit({
      type: 'message',
      body: 'Only a launch plan can be checked for changes. Ask me about one of the plans in this project.',
      claims: [],
    });
    return runCtx(deps, REFRESH_STEPS).stop('finished');
  }
  const ctx = runCtx(deps, REFRESH_STEPS + (deps.research.enabled ? 1 : 0));
  const question = questionFor(handoff.message.text, handoff.title);

  ctx.trace('Reading the plan’s brief again');
  const same = applyChange(inputs, NO_CHANGE, handoff.title, deps.config.applyChange);
  for (const a of same.resolved) deps.tools.entities.set(a.entityId, a);
  try {
    const { searchFailed: _, ...comps } = await findComps(
      deps,
      ctx.keep,
      same.read,
      same.resolved,
      same.used,
      same.dropped,
    );
    const asked = await askQloo(deps, ctx, {
      title: handoff.title,
      read: same.read,
      comps,
      understanding: inputs.understanding ?? null,
      rivals: inputs.rivals ?? [],
      band: inputs.band ?? null,
      brands: inputs.brands ?? [],
      ...(question ? { question } : {}),
    });

    ctx.trace('Setting the answers beside what the plan saved');
    const today = new Date().toISOString().slice(0, 10);
    const findings = compareFindings(saved.findings, asked.grounded.findings);
    const sources = deps.research.enabled
      ? compareSources(saved.sources, asked.sources, today)
      : [];
    const gaps = [
      ...(deps.research.enabled
        ? []
        : [
            'Web research is not set up here, so dated facts such as rivals and windows were not rechecked.',
          ]),
      ...(saved.sources.length === 0 && deps.research.enabled
        ? [
            'The plan saved no web facts, so nothing on the web can be called changed. Anything found is new.',
          ]
        : []),
      ...asked.grounded.gaps.map((g) => `${g.item}: ${g.why}`),
      'A fresh check asks the plan’s brief again; it does not replay the plan’s exact calls. A finding it does not return is not a change.',
    ];
    const report: RefreshReport = {
      planOutputId: plan.id,
      checkedOn: today,
      planAsOf: plan.createdAt.slice(0, 10),
      question,
      findings,
      sources,
      gaps,
      affected: affectedLines(saved, findings, sources),
    };

    const moved = findings.filter((f) => f.status === 'moved').length;
    const fresh = findings.filter((f) => f.status === 'new').length;
    const changedPages = sources.filter((s) => s.status === 'changed').length;
    const headline =
      moved + changedPages === 0
        ? `Nothing in this plan’s evidence moved. ${fresh} newly found.`
        : `${moved} ${moved === 1 ? 'finding' : 'findings'} moved and ${changedPages} ${changedPages === 1 ? 'page' : 'pages'} changed since this plan. ${report.affected.length} ${report.affected.length === 1 ? 'line rests' : 'lines rest'} on them.`;
    deps.emit({
      type: 'message',
      body: `${headline} Your plan is unchanged. Open the check to see what moved, and ask me to fix the plan if you want a revision built on today’s evidence.`,
      claims: [],
    });
    return ctx.stop('finished', null, {
      kind: 'refresh',
      title: 'What changed',
      brief: plan.brief,
      plan: null,
      report: null,
      refresh: report,
      headline,
      moves: [],
      confidence: {
        level: findings.filter((f) => f.status !== 'new').length >= 3 ? 'medium' : 'low',
        why: 'A fresh check asks the same brief again and compares by finding; it does not replay the exact calls.',
      },
      inputs,
    });
  } catch (err) {
    if (err instanceof QlooBudgetError) {
      deps.emit({
        type: 'message',
        body: 'The Qloo allowance for now is used up, so I could not check what changed. Try again later.',
        claims: [],
      });
      return ctx.stop('finished');
    }
    throw err;
  }
}
