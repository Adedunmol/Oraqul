import { audienceOutputSchema, searchEntityOutputSchema } from '@oraqul/engine';
import type { AgentReply, Claim } from '@oraqul/schema';
import type { AgentContext, HistoryItem, Planner, Step } from './types.js';

export const MATCH_QUESTION_ID = 'entity.match';

type ToolHistory = Extract<HistoryItem, { kind: 'tool' | 'failed' }>;

function latest(history: HistoryItem[], name: string): ToolHistory | undefined {
  return history.findLast(
    (item): item is ToolHistory =>
      (item.kind === 'tool' || item.kind === 'failed') && item.name === name,
  );
}

const typeWord = (urn: string) => urn.replace('urn:entity:', '').replace('_', ' ');
const bandWord = (band: string) => band.replaceAll('_', ' ');

/**
 * Deterministic stand-in for the model: find the lead title, ask which one when the name is
 * ambiguous, read its audience, let Books ask Film, then write up only what the receipts say.
 * It runs the demo and the tests with no key, and shows the shape a real planner must follow.
 */
export class ScriptedPlanner implements Planner {
  async next(context: AgentContext): Promise<Step> {
    const { history, project, pack } = context;

    const search = latest(history, 'searchEntity');
    if (!search) {
      return {
        kind: 'tool',
        name: 'searchEntity',
        input: { name: project.lead, types: pack.qloo.titles },
      };
    }
    if (search.kind === 'failed') return cannotTest(project.lead, search);

    const found = searchEntityOutputSchema.parse(search.data);
    const first = found.candidates[0];
    if (!first) {
      return finish({
        message: `Qloo has no match for ${project.lead}, so nothing about it could be tested.`,
        claims: [{ text: `No Qloo match for ${project.lead}.`, receiptIds: search.receiptIds }],
      });
    }

    let chosen = first;
    if (found.ambiguous) {
      const answer = history.findLast((item) => item.kind === 'answer')?.answer;
      const picked =
        answer?.kind === 'options' && answer.questionId === MATCH_QUESTION_ID
          ? found.candidates.find((c) => c.entityId === answer.optionIds[0])
          : undefined;
      if (!picked) {
        return {
          kind: 'ask',
          question: {
            id: MATCH_QUESTION_ID,
            card: 'match',
            prompt: `More than one title is called ${project.lead}. Which one do you mean?`,
            options: found.candidates.map((c) => ({
              id: c.entityId,
              label: c.name,
              description: c.types.map(typeWord).join(', '),
            })),
          },
        };
      }
      chosen = picked;
    }

    const audience = latest(history, 'audienceBySegment');
    if (!audience) {
      return { kind: 'tool', name: 'audienceBySegment', input: { entityIds: [chosen.entityId] } };
    }
    if (audience.kind === 'failed') return cannotTest(chosen.name, audience);

    const [consultTarget] = pack.consults;
    const consulted = history.some((item) => item.kind === 'consult');
    if (context.canAsk && consultTarget && !consulted) {
      return {
        kind: 'consult',
        category: consultTarget,
        question: `Who would a screen adaptation of "${project.lead}" reach, by age?`,
      };
    }

    const claims: Claim[] = [
      {
        text: `${chosen.name} is in Qloo as a ${chosen.types.map(typeWord).join(' or ')}.`,
        receiptIds: search.receiptIds,
      },
    ];
    const segment = audienceOutputSchema
      .parse(audience.data)
      .segments.find((s) => s.entityId === chosen.entityId);
    if (segment?.topAgeBand) {
      const affinity = segment.age[segment.topAgeBand];
      claims.push({
        text: `Its audience skews most to the ${bandWord(segment.topAgeBand)} age band (affinity ${affinity}).`,
        receiptIds: audience.receiptIds,
      });
    } else {
      claims.push({
        text: `Qloo returned no audience skew for ${chosen.name}, so this is not tested.`,
        receiptIds: audience.receiptIds,
      });
    }
    for (const item of history) {
      if (item.kind !== 'consult') continue;
      for (const claim of item.claims) {
        claims.push({
          text: `${item.category} agent: ${claim.text}`,
          receiptIds: claim.receiptIds,
        });
      }
    }

    const demo = context.receipts.some((r) => r.source === 'demo');
    const message = `${claims.map((c) => c.text).join(' ')}${demo ? ' This run used demo data, not live Qloo.' : ''}`;
    return finish({ message, claims });
  }
}

function finish(reply: AgentReply): Step {
  return { kind: 'finish', reply };
}

function cannotTest(subject: string, failed: Extract<ToolHistory, { kind: 'failed' }>): Step {
  const claims = failed.receiptId
    ? [{ text: `Could not test ${subject}: ${failed.reason}`, receiptIds: [failed.receiptId] }]
    : [];
  return finish({ message: `Could not test ${subject}. ${failed.reason}`, claims });
}
