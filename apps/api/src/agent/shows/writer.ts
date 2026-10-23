import { showsPlan } from '@oraqul/packs';
import type { CompUsed, Finding, LaunchSectionKey } from '@oraqul/schema';
import type { LanguageModel } from 'ai';
import type { ProviderOptions } from '../../llm/llm.js';
import { slug } from '../launch/brief.js';
import { agesPhrase, list } from '../launch/findings.js';
import {
  grounded,
  type AnswerInput as LaunchAnswerInput,
  FallbackPlanWriter as LaunchFallbackWriter,
  ModelPlanWriter as LaunchModelWriter,
  type PlanWriter as LaunchPlanWriter,
  TemplatePlanWriter as LaunchTemplateWriter,
  type WriteInput as LaunchWriteInput,
  NAMED,
  playbook,
  type WriterKit,
  type WrittenLine,
} from '../launch/writer.js';
import type { ShowsRead } from './read.js';

export type WriteInput = LaunchWriteInput<ShowsRead>;
export type AnswerInput = LaunchAnswerInput<ShowsRead>;
export type PlanWriter = LaunchPlanWriter<ShowsRead>;

export const RULES = `How to write:
- You are a senior live event promoter. Write the plan a promoter, a manager or a venue would act on this week for one show or a short run. Decisions with reasons: each line is the move, why, and how, in one to three sentences. Be specific: names, places, weeks, who does what.
- Answer what the person asked, using everything they gave. Their cities, show date, age band and comparable acts are decisions to plan for, not hypotheses to replace. If the audience data shows one is weak, keep it, say so plainly, and say what to do about it.
- What you know about the show is only what the person wrote: the act, the kind of show, the cities, the date, the audience and the comparable acts. Never describe the material, the set or the story beyond that.
- Never state a ticket price, a venue capacity, a sell-through figure or a date of your own. Those are the team's to give, and the on-sale dates, the presale, the pacing and the final push are written by code. Where the team gave none, plan without it.
- The audience data ranks the person's cities by where the act's audience is densest. A city that ranks lower can still be a good night out: never call a city a weak or poor market. Use the ranking for where the spend and the extra dates go.
- Use your launch knowledge freely: promoters, local press and radio, creators, venues and community networks, ideas from the show. These are "playbook" lines. They cite nothing and may name anything real.
- Every claim about what the audience likes, plays, listens to, buys, or where it goes out, is "grounded": it cites the ids of the findings it rests on in findingIds, and names the findings' own candidates. Never present a name you know but no finding returned as something this audience likes.
- Write for a marketing team, not an analyst. Never use the words lift, index, affinity, cells, Qloo, findings, tested, confidence or data. No scores or decimals.
- Never describe what could not be measured. Every city and choice the team made gets a role and a move.
- Never invent a number. Money, ticket sales, followers and the dates of other shows may be stated only from a web fact in the list, and the line must cite its id in sourceIds. With no web facts, state none of them.
- Pick from the candidates. Leave out any that do not fit the act or the market, or are global mass-market giants a single show would not land, and list each in "skipped" with a short reason.
- Candidates are listed in the order Qloo ranks them for this audience. Keep that order: lead with the highest-ranked candidate you keep and name the others after it.
- Sponsors in the findings were chosen as brands that could realistically say yes, then ranked for the audience. A brand seldom pays a single show in cash: the realistic ask is in kind or a co-promotion (a bar, a presale offer, ad space). Write it as an ask the team can make.
- Say each thing once. Plain, direct words. No exclamation marks, no hype, no hedging. Never mention receipts, call ids, Qloo endpoints or scores. About 900 words in all.`;

export const PLAN_WRITER_SYSTEM = `You write a launch plan for a single live show or a short run for Oraqul. You get the person's request, the brief as read, and findings measured in Qloo taste data about the audience of the act and its comparable acts.

${RULES}

Sections (write only the ones listed in the request, in that order):
- bottom-line: three moves, the most important first. The first answers where and in what order: the home city first, the other cities after, naming every one of the team's cities. The next two are the decisions that matter most for this show, such as the sponsor with the biggest pull or the partner venue.
- positioning: the hook (group "Hook"), three key messages (group "Key messages"), and one line per comparable act (group "Comps"). The hook and messages come from the brief and from what the audience plays, never from an invented set or story.
- audience: who the core and secondary audience are and what they play and listen to, by city where it differs.
- markets: one line per team city (group = the city): its role for the show, and the one thing to do there. Then "Worth a look" alternatives, only from the "Worth a look" finding.
- partnerships: sponsors and partners, each tied to the city of its finding, and what the partnership is.
- publicity: podcasts, local press and creators, with the angle for each.
- venues: the venues where this audience goes out, per city, and how a partner venue could help.
- creative: two to four hook options for the lead city, and one key art brief. Guides only: Oraqul writes the brief and a person makes the ad, the clip or the image. Never offer to generate one. The on-sale plan, the final push, the calendar, channels and what to measure are written by code, so write none of them.
- risks: what could go wrong and what to do. A risk about taste or audience is grounded.`;

export const ANSWER_WRITER_SYSTEM = `You answer a question about a live show launch plan for Oraqul, from findings measured in Qloo taste data and your launch knowledge. Two to five lines. Answer the question first.

${RULES}

If the honest answer would change a decision in the plan (a city, the age band, a comparable act), set changesDecision to true and say what you would change. Do not change the plan yourself: the agent offers to run it as a what-if.`;

const asNumber = (n: number) => Math.round(n).toLocaleString('en-US');

export function briefBlock(title: string, read: ShowsRead, comps: CompUsed[]): string {
  return [
    `Show: ${title} (${read.showType ?? 'live show'})`,
    read.act ? `Act: ${read.act}` : '',
    read.genre ? `Sound or kind of act: ${read.genre}` : '',
    read.country ? `Country: ${read.country}` : '',
    read.places.length ? `The team's cities, in the order they set: ${read.places.join(', ')}` : '',
    read.ages.length ? `The team's age band: ${agesPhrase(read.ages)}` : '',
    read.gender ? `The team says mostly ${read.gender === 'female' ? 'women' : 'men'}` : '',
    read.window ? `Show date: ${read.window}` : 'No show date given',
    read.capacity ? `Venue capacity: ${asNumber(read.capacity)}` : 'No venue capacity given',
    read.priceBand ? `Ticket price band: ${read.priceBand}` : 'No ticket price band given',
    read.budget
      ? `Marketing budget: ${read.budget.currency}${asNumber(read.budget.amount)}`
      : 'No marketing budget given: plan for an independent show',
    read.supportActs.length ? `Support acts already booked: ${read.supportActs.join(', ')}` : '',
    read.partners.length ? `Partners already signed: ${read.partners.join(', ')}` : '',
    comps.length
      ? `Comparable acts: ${comps.map((c) => `${c.name}${c.source === 'added' ? ' (added by Oraqul)' : ''}`).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** A city's role in plain words, from the verdict on it. */
export function marketRole(verdict: Finding['verdict']): string {
  switch (verdict) {
    case 'holds':
      return 'a lead city: put the biggest show and the most spend there';
    case 'weak':
      return 'a solid city: run it selectively and grow it with local press and creators';
    case 'breaks':
      return 'a smaller city: keep the show small and lean on creators and community';
    default:
      return 'a community-led city: start with creator and partner moves';
  }
}

/** The default lines for one section, from the findings and the brief. */
export function templateSection(key: LaunchSectionKey, input: WriteInput): WrittenLine[] {
  const { read, findings } = input;
  const byId = (id: string) => findings.find((f) => f.id === id);
  const byQuery = (q: string) => findings.filter((f) => f.query === q);
  const top = (f: Finding, n = NAMED) => f.entities.slice(0, n).map((e) => e.name);
  const markets = byId('f-markets');
  const teamOrder = markets?.entities.map((e) => e.name) ?? read.places;
  const age = byId('f-a-age');
  const audience = byId('f-audience');
  const withCity = (f: Finding, n = 2) => [...top(f, n), f.context.city ?? ''].filter(Boolean);

  switch (key) {
    case 'bottom-line': {
      const lines: WrittenLine[] = [];
      const [first, ...rest] = teamOrder;
      if (markets && first) {
        lines.push(
          grounded(
            `Start in ${first}${rest.length ? `, then ${list(rest)}` : ''}: that is where the act's audience is strongest among your cities.`,
            markets,
            teamOrder,
          ),
        );
      } else if (read.places.length) {
        lines.push(
          playbook(`Plan the show for ${list(read.places)} as you set them.`, read.places),
        );
      }
      const who = audience?.context.audience;
      if (age && read.ages.length) {
        lines.push(
          grounded(
            age.verdict === 'holds' || !who
              ? `Aim the campaign at ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, as planned.`
              : `Keep your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, but lead the creative with ${who}, where this act is strongest.`,
            audience && who ? audience : age,
            [],
          ),
        );
      } else if (audience && who) {
        lines.push(grounded(`Aim the campaign at ${who}.`, audience, []));
      }
      const brands = byQuery('brands')[0];
      if (brands) {
        lines.push(
          grounded(
            `Approach ${list(top(brands, 2))} first for a sponsor: they rank highest with this audience in ${brands.context.city}.`,
            brands,
            withCity(brands),
          ),
        );
      }
      return lines.slice(0, 3);
    }
    case 'positioning': {
      const comps = input.comps.map((c) => c.name);
      const lines: WrittenLine[] = [
        playbook(
          read.genre ? `Lead with the act: ${read.genre}.` : 'Lead with the act.',
          [],
          'Hook',
        ),
      ];
      if (comps.length) {
        lines.push(
          playbook(
            `Pitch the show to press and promoters in the company of ${list(comps)}.`,
            comps,
            'Comps',
          ),
        );
      }
      return lines;
    }
    case 'audience': {
      const lines: WrittenLine[] = [];
      const who = audience?.context.audience;
      if (audience && who) {
        lines.push(grounded(`The core audience is ${who}.`, audience, [], 'Who they are'));
      }
      for (const f of byQuery('similar')) {
        const city = f.context.city;
        lines.push(
          grounded(
            `${city ? `In ${city} they` : 'They'} also play ${list(top(f))}.`,
            f,
            [...top(f), ...(city ? [city] : [])],
            city ?? 'What else they like',
          ),
        );
      }
      return lines;
    }
    case 'markets': {
      const lines: WrittenLine[] = [];
      for (const city of teamOrder) {
        const tested = byId(`f-a-place-${slug(city)}`);
        lines.push(
          tested
            ? grounded(`Plan ${city} as ${marketRole(tested.verdict)}.`, tested, [city], city)
            : playbook(`Plan ${city} as you set it.`, [city], city),
        );
      }
      const worth = byId('f-worth-a-look');
      if (worth) {
        lines.push(
          grounded(
            worth.text,
            worth,
            worth.entities.map((e) => e.name).concat(teamOrder.slice(-1)),
            'Worth a look',
          ),
        );
      }
      return lines;
    }
    case 'partnerships': {
      const lines: WrittenLine[] = byQuery('brands').map((f) =>
        grounded(`Sponsors: ${list(top(f, 2))} in ${f.context.city}.`, f, withCity(f), 'Sponsors'),
      );
      if (read.partners.length) {
        lines.push(
          playbook(
            `Brief ${list(read.partners)} first: they are already signed.`,
            read.partners,
            'Already signed',
          ),
        );
      }
      return lines;
    }
    case 'publicity': {
      const lines: WrittenLine[] = [];
      const pods = byId('f-podcasts');
      if (pods) {
        lines.push(grounded(`Pitch the act to ${list(top(pods))}.`, pods, top(pods), 'Podcasts'));
      }
      lines.push(
        playbook(
          'Send local press, radio and listings editors the show page, the date and one story about the act, four weeks before general on sale.',
          [],
          'Press',
        ),
      );
      return lines;
    }
    case 'venues': {
      return byQuery('venues').map((f) =>
        grounded(
          `In ${f.context.city}, the places this audience goes out are ${list(top(f, 2))}: approach them for a partner night or a takeover.`,
          f,
          withCity(f),
          f.context.city,
        ),
      );
    }
    case 'risks': {
      const lines: WrittenLine[] = findings
        .filter(
          (f) => f.id.startsWith('f-a-place-') && (f.verdict === 'weak' || f.verdict === 'breaks'),
        )
        .flatMap((f) => {
          const city = f.id.replace('f-a-place-', '');
          const name = read.places.find((p) => slug(p) === city) ?? city;
          return [
            grounded(
              `${name} may sell softer than your other cities: keep the show small and lean on creators and community there.`,
              f,
              [name],
              null,
            ),
          ];
        });
      lines.push(
        playbook(
          'A date that slips: hold the date, and keep the first show to the city you can fully support.',
        ),
      );
      return lines;
    }
    default:
      return [];
  }
}

export function sectionTitle(key: LaunchSectionKey): string {
  return showsPlan.SECTION_TITLES[key];
}

export const showsWriterKit: WriterKit<ShowsRead> = {
  planSystem: PLAN_WRITER_SYSTEM,
  answerSystem: ANSWER_WRITER_SYSTEM,
  brief: briefBlock,
  templateSection,
};

export class ModelPlanWriter extends LaunchModelWriter<ShowsRead> {
  constructor(model: LanguageModel, timeoutMs: number, options: ProviderOptions = {}) {
    super(model, timeoutMs, showsWriterKit, options);
  }
}

/** Falls back to the template writer when the model fails, so a plan never stops at writing. */
export class FallbackPlanWriter extends LaunchFallbackWriter<ShowsRead> {}

export class TemplatePlanWriter extends LaunchTemplateWriter<ShowsRead> {
  constructor() {
    super(showsWriterKit);
  }
}
