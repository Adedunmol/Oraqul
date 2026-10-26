import type { Job } from '@oraqul/schema';

export interface NextStep {
  id: string;
  label: string;
  /** What the chip sends. Steps from the demo store have none and run through the demo instead. */
  message?: string;
}

/** The part of an output a step is worked out from. */
export interface StepSource {
  kind: Job;
  title: string;
  createdAt: string;
  brief: {
    places: { name: string; lift: number }[];
    assumptions: { id: string; text: string }[];
  };
  plan: {
    findings: { query: string; entities: { name: string }[] }[];
    territories?: { name: string }[];
    opportunities?: { kind: string; name: string }[];
  } | null;
}

const key = (text: string) => text.trim().toLowerCase();
const MAX_STEPS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A plan this old is worth checking against today's data. */
const STALE_DAYS = 14;

/**
 * Up to three things worth asking next, worked out from the project's latest plan and what the
 * project already has: a what-if on the lead city, a rival date check, a partner brief. Each is a
 * message the agent already answers, so a step runs the same way as typing it.
 */
export function nextStepsFor(outputs: StepSource[], now: Date = new Date()): NextStep[] {
  const plans = outputs
    .filter((o) => o.plan && (o.kind === 'build' || o.kind === 'scenario' || o.kind === 'fix'))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const base = plans.at(-1);
  if (!base?.plan) return [];

  const steps: NextStep[] = [];
  // An older plan rests on data that may have moved, so checking it comes first.
  const aged = (now.getTime() - Date.parse(base.createdAt)) / DAY_MS;
  if (
    aged >= STALE_DAYS &&
    !outputs.some((o) => o.kind === 'refresh' && o.createdAt > base.createdAt)
  ) {
    steps.push({
      id: 'refresh',
      label: 'Check what has changed',
      message: 'Check what has changed since this plan was made',
    });
  }
  const ranked = [...base.brief.places].sort((a, b) => b.lift - a.lift);
  // The team's own first city is the first place assumption, in the order they gave.
  const yours = base.brief.assumptions
    .map((a) =>
      a.id.startsWith('a-place-') ? /^(.+?) is a strong market/.exec(a.text)?.[1] : null,
    )
    .find(Boolean);
  const tried = (city: string) =>
    outputs.some((o) => o.kind === 'scenario' && key(o.title).includes(key(city)));
  const lead =
    ranked.length >= 2 && yours && key(ranked[0]?.name ?? '') !== key(yours)
      ? ranked[0]
      : ranked.length >= 2
        ? ranked[1]
        : undefined;
  if (lead && !tried(lead.name)) {
    steps.push({
      id: `scn:lead:${key(lead.name)}`,
      label: `What if we open in ${lead.name} first?`,
      message: `What if we open in ${lead.name} first?`,
    });
  }
  const market = base.plan.opportunities?.find((o) => o.kind === 'market' && !tried(o.name));
  if (market) {
    steps.push({
      id: `scn:opp:${key(market.name)}`,
      label: `What if we add ${market.name}?`,
      message: `What if we add ${market.name}?`,
    });
  }
  const home = base.plan.territories?.[0]?.name;
  if (home && !outputs.some((o) => o.kind === 'creative')) {
    steps.push({
      id: 'creative',
      label: 'Make the creative kit',
      message: `Make the creative kit for ${home}`,
    });
  }
  if (!outputs.some((o) => o.kind === 'date')) {
    steps.push({
      id: 'date',
      label: 'Check rival release dates',
      message: 'Check my release date against rival releases',
    });
  }
  if (!outputs.some((o) => o.kind === 'partner')) {
    const brand = base.plan.findings
      .filter((f) => f.query === 'brands')
      .flatMap((f) => f.entities)[0];
    if (brand) {
      steps.push({
        id: 'partner',
        label: `Brief ${brand.name} as a partner`,
        message: `Draft a partner brief for ${brand.name}`,
      });
    }
  }
  if (base.kind === 'build' && !outputs.some((o) => o.kind === 'fix')) {
    steps.push({ id: 'fix', label: 'Fix this plan', message: 'Fix this plan' });
  }
  return steps.slice(0, MAX_STEPS);
}
