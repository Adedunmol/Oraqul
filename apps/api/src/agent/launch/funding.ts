import type {
  FundData,
  LaunchPlan,
  Move,
  Output,
  OverallConfidence,
  PartnerOption,
  PlanSource,
  ProjectFacts,
  Receipt,
  SponsorData,
} from '@oraqul/schema';
import { eligibilityOf } from '../../funding/eligibility.js';
import type { FundingResearcher, VerifiedFund } from '../../funding/fund-research.js';
import { type ActiveRules, same } from '../../team-rules/compile.js';
import type { FundingRunItem } from '../category-agents.js';
import { type CheckContext, checkSections } from './check.js';
import type { LaunchConfig } from './config.js';
import type { FollowUpDeps } from './follow-ups.js';
import type { LaunchInputs, PlanRun } from './pipeline.js';
import type { LaunchRead } from './read-core.js';
import type { WrittenLine, WrittenSection } from './writer.js';

// Funding and sponsors (spec §5.20). Sponsors are the plan's own brands that Qloo ranked for each
// territory, so a sponsor line cites a Qloo finding; each is looked up on the web for a recent
// entertainment sponsorship and keeps it only when a fetched page holds the words. Funds come from
// the web at run time, each field the page's own or unknown. Every line goes through the same line
// check as a plan line, and a sponsor or fund whose line does not pass is not kept. No fee, no
// price and no loan terms are ever quoted, and no line says a team qualifies.

const PER_TERRITORY = 2;
const MAX_SPONSORS = 6;

const WORDS: Record<'eligible' | 'check' | 'not-eligible', string> = {
  eligible: 'Its published criteria appear met.',
  check: 'Some of its published criteria cannot be compared yet.',
  'not-eligible': 'A published criterion appears not met.',
};

interface Candidate {
  partner: PartnerOption;
  territory: string;
}

/** The brands Qloo ranked for each territory that the budget can reach and the team has not ruled out. */
export function sponsorCandidates(plan: LaunchPlan, rules: ActiveRules): Candidate[] {
  const out: Candidate[] = [];
  const taken = new Set<string>();
  for (const t of [...plan.territories].sort((a, b) => a.order - b.order)) {
    const options = plan.partners
      .filter(
        (p) =>
          t.partnerIds.includes(p.id) &&
          p.kind === 'brand' &&
          p.from !== 'team' &&
          p.fit !== null &&
          p.findingIds.length > 0 &&
          p.budgetFit !== 'out' &&
          !rules.blockedPartners.some((b) => same(b, p.name)),
      )
      .sort((a, b) => (a.fit?.place ?? 99) - (b.fit?.place ?? 99))
      .slice(0, PER_TERRITORY);
    for (const partner of options) {
      const key = `${partner.name.toLowerCase()}|${t.name.toLowerCase()}`;
      if (taken.has(key) || out.length >= MAX_SPONSORS) continue;
      taken.add(key);
      out.push({ partner, territory: t.name });
    }
  }
  return out;
}

const line = (over: Partial<WrittenLine> & Pick<WrittenLine, 'kind' | 'text'>): WrittenLine => ({
  findingIds: [],
  sourceIds: [],
  names: [],
  group: null,
  ...over,
});

const fundFact = (f: VerifiedFund) =>
  [f.name, f.amount, f.deadline ? `Closes ${f.deadline}.` : null].filter(Boolean).join('. ');

/** Saved as an output of kind `funding`, a narrow plan of checked lines, beside the plan it was run on. */
export async function runFunding<R extends LaunchRead>(
  deps: Pick<FollowUpDeps<R>, 'emit' | 'config'> & { researcher: FundingResearcher },
  plan: Output,
  inputs: LaunchInputs<R>,
  facts: ProjectFacts,
  rules: ActiveRules,
  title: string,
): Promise<PlanRun> {
  const source = plan.plan;
  const config: LaunchConfig<R> = deps.config;
  const finish = (body: string): PlanRun => {
    deps.emit({ type: 'message', body, claims: [] });
    return { reason: 'finished', state: null, receipts: [], output: null, tokens: 0 };
  };
  if (!source || source.scope !== 'full') {
    return finish(
      'Funding and sponsors are found for a full launch plan, and this output is not one.',
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const candidates = sponsorCandidates(source, rules);
  const territories = source.territories.map((t) => t.name);
  let tokens = 0;
  const notes: string[] = [];

  const evidence = new Map<
    string,
    Awaited<ReturnType<FundingResearcher['evidence']>>['evidence']
  >();
  let funds: VerifiedFund[] = [];
  if (deps.researcher.enabled) {
    deps.emit({
      type: 'trace.step',
      agent: config.category,
      step: 1,
      of: 2,
      text: `Looking for recent sponsorships by ${candidates.length} brands`,
    });
    for (const c of candidates) {
      try {
        const found = await deps.researcher.evidence({
          brand: c.partner.name,
          category: config.category,
          territory: c.territory,
          today,
        });
        tokens += found.tokens;
        evidence.set(`${c.partner.name}|${c.territory}`, found.evidence);
      } catch {
        notes.push(`Could not look up sponsorships by ${c.partner.name}.`);
      }
    }
    deps.emit({
      type: 'trace.step',
      agent: config.category,
      step: 2,
      of: 2,
      text: 'Looking for funds, grants and programmes that are open now',
    });
    try {
      const found = await deps.researcher.funds({
        category: config.category,
        stage: facts.stage,
        nationality: facts.nationality,
        territories,
        today,
      });
      tokens += found.tokens;
      funds = found.funds;
    } catch {
      notes.push('Could not look up funds this time: the web search failed.');
    }
  } else {
    notes.push(
      'Web search is not set up, so no funds or sponsorship evidence were looked up. The sponsors below are the brands Qloo ranked for your territories.',
    );
  }

  // Sources the lines cite: one for each sponsorship found and each fund, with the day it was read.
  const sources: PlanSource[] = [];
  const sourceOf = (fact: string, title: string, url: string, retrievedAt: string) => {
    const id = `w${sources.length + 1}`;
    sources.push({ id, fact, title, url, retrievedAt });
    return id;
  };

  const written: WrittenLine[] = [];
  const sponsorKey = new Map<string, Candidate>();
  const evidenceKey = new Map<string, Candidate>();
  for (const c of candidates) {
    const { partner, territory } = c;
    const grounded = `${partner.name} is one of the brands this audience likes in ${territory}.`;
    written.push(
      line({
        kind: 'grounded',
        text: grounded,
        findingIds: partner.findingIds,
        names: [partner.name, territory],
        group: 'Sponsors',
      }),
    );
    sponsorKey.set(grounded, c);
    const found = evidence.get(`${partner.name}|${territory}`);
    if (found) {
      const id = sourceOf(found.quote, found.title, found.url, found.retrievedAt);
      const text = `${partner.name} has backed entertainment before: ${found.quote.replace(/[.\s]+$/, '')}.`;
      written.push(
        line({ kind: 'playbook', text, sourceIds: [id], names: [partner.name], group: 'Sponsors' }),
      );
      evidenceKey.set(text, c);
    }
  }
  const fundKey = new Map<string, VerifiedFund>();
  const fundLines = funds.map((f) => {
    const eligibility = eligibilityOf(
      f.criteria,
      {
        ...facts,
        category: config.category,
        territories,
      },
      f.otherConditions,
    );
    const id = sourceOf(fundFact(f), f.sourceTitle, f.sourceUrl, f.retrievedAt);
    const text = `${f.name}${f.owner ? ` from ${f.owner}` : ''} is a ${f.type} that is open now.${f.amount ? ` It offers ${f.amount}.` : ''}${f.deadline ? ` It closes ${f.deadline}.` : ''} ${WORDS[eligibility.verdict]} Confirm the terms on the page before applying.`;
    fundKey.set(text, f);
    return {
      f,
      eligibility,
      written: line({
        kind: 'playbook',
        text,
        sourceIds: [id],
        names: [f.name, ...(f.owner ? [f.owner] : [])],
        group: 'Funds and grants',
      }),
    };
  });
  written.push(...fundLines.map((x) => x.written));

  const section: WrittenSection = { key: 'partnerships', lines: written };
  const ctx: CheckContext = {
    rules: config.rules,
    findings: source.findings,
    sources,
    briefNames: [
      title,
      ...inputs.read.places,
      ...source.territories.map((t) => t.name),
      ...candidates.map((c) => c.partner.name),
      ...funds.flatMap((f) => [f.name, ...(f.owner ? [f.owner] : [])]),
    ],
    briefText: '',
    teamCities: inputs.read.places,
    teamAges: inputs.read.ages,
    allowed: ['partnerships'],
    blockedPartners: rules.blockedPartners,
    budgetMax: rules.budgetMax,
  };
  const { sections, dropped } = checkSections([section], ctx);
  const kept = sections.flatMap((s) => s.lines);
  const keptText = new Set(kept.map((l) => l.text));

  // Only what survived the line check is kept: a sponsorship whose line was dropped is not shown.
  const items: FundingRunItem[] = [];
  for (const c of candidates) {
    const grounded = [...sponsorKey.entries()].find(([, v]) => v === c)?.[0] ?? '';
    if (!keptText.has(grounded)) continue;
    const proof = [...evidenceKey.entries()].find(([, v]) => v === c)?.[0];
    const found = evidence.get(`${c.partner.name}|${c.territory}`);
    const data: SponsorData = {
      moneyType: c.partner.moneyType,
      fit: c.partner.fit ? { place: c.partner.fit.place, of: c.partner.fit.of } : null,
      findingIds: c.partner.findingIds,
      evidence: proof && keptText.has(proof) && found ? found : null,
    };
    items.push({ kind: 'sponsor', name: c.partner.name, territory: c.territory, data });
  }
  for (const x of fundLines) {
    if (!keptText.has(x.written.text)) continue;
    const data: FundData = {
      owner: x.f.owner,
      type: x.f.type,
      amount: x.f.amount,
      currency: x.f.currency,
      deadline: x.f.deadline,
      criteria: x.f.criteria,
      applicationUrl: x.f.applicationUrl,
      sourceUrl: x.f.sourceUrl,
      sourceTitle: x.f.sourceTitle,
      retrievedAt: x.f.retrievedAt,
      eligibility: x.eligibility,
    };
    items.push({ kind: 'fund', name: x.f.name, territory: '', data });
  }

  const cited = new Set(kept.flatMap((l) => l.sourceIds));
  const keptSources = sources.filter((s) => cited.has(s.id));
  const findingIds = new Set(kept.flatMap((l) => l.findingIds));
  const findings = source.findings.filter((f) => findingIds.has(f.id));
  const receipts: Receipt[] = kept.flatMap((l) => {
    const f = findings.find((x) => x.id === l.findingIds[0]);
    const made = f && plan.receipts.find((r) => f.callIds.includes(r.callId));
    return made ? [{ ...made, lineId: l.id, rule: f?.why ? `${f.why}.` : made.rule }] : [];
  });

  const sponsors = items.filter((i) => i.kind === 'sponsor').length;
  const open = items.filter((i) => i.kind === 'fund').length;
  if (items.length === 0) {
    return finish(
      `${notes.join(' ') || 'Nothing could be found that a page confirms.'} I found no sponsor or fund I could source, so nothing was saved.`,
    );
  }
  const note = notes.length ? ` ${notes.join(' ')}` : '';
  const headline = `${sponsors} ${sponsors === 1 ? 'sponsor' : 'sponsors'} that fit your territories and ${open} ${open === 1 ? 'fund' : 'funds'} open now, each with its source and the day it was read. Terms change: confirm on the source page before applying.${note}`;
  const moves: Move[] = [
    { text: 'Confirm each fund’s terms on its own page before you apply.', lineId: null },
    {
      text: 'Draft a pitch or an application from the Funding and sponsors tab, and send it yourself.',
      lineId: null,
    },
  ];
  const confidence: OverallConfidence = {
    level: findings.length ? 'medium' : 'low',
    why: 'Sponsor fit comes from Qloo; sponsorships and funds are read from pages on the day shown.',
  };
  const narrow: LaunchPlan = {
    ...source,
    scope: 'narrow',
    sections,
    findings,
    sources: keptSources,
    dropped,
    writer: 'template',
    understanding: null,
    review: null,
    process: null,
    signal: null,
    territories: [],
    calls: [],
    partners: [],
    calendar: [],
  };
  deps.emit({ type: 'message', body: headline, claims: [] });
  return {
    reason: 'finished',
    state: null,
    receipts,
    output: {
      kind: 'funding',
      title: 'Funding and sponsors',
      brief: plan.brief,
      plan: narrow,
      report: null,
      headline,
      moves,
      confidence,
      inputs,
      funding: { planId: plan.id, items },
    },
    tokens,
  };
}
