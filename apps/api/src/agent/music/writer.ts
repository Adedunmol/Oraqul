import { musicPlan } from '@oraqul/packs';
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
import type { MusicRead } from './read.js';

export type WriteInput = LaunchWriteInput<MusicRead>;
export type AnswerInput = LaunchAnswerInput<MusicRead>;
export type PlanWriter = LaunchPlanWriter<MusicRead>;

export const RULES = `How to write:
- You are a senior music release and tour strategist. Write the plan a label, a manager or a booking agent would act on this week. Decisions with reasons: each line is the move, why, and how, in one to three sentences. Be specific: names, places, weeks, who does what.
- Answer what the person asked, using everything they gave. Their cities, tour order, age band, sound-alike artists and window are decisions to plan for, not hypotheses to replace. If the audience data shows one is weak, keep it, say so plainly, and say what to do about it.
- What you know about the music is only what the person wrote: the artist, the sound, the release type, the cities, the audience and the sound-alikes. Never describe the songs, lyrics, themes, collaborators or story beyond that.
- The audience data ranks the person's cities by where the artist's audience is densest. A city that ranks lower can still be strong for support acts, creators or campuses: never call a city a weak or poor market. Use the ranking for where the spend, the extra dates and the community work go. The tour order is the team's to set: if the data says another order starts stronger, say so and offer it beside theirs, never in place of it.
- Every sound-alike artist the person named gets its own line: what it signals to press and booking, and how close a match it is. If you are not sure what an artist is, say only what you are sure of.
- Use your launch knowledge freely: release windows and the seasons to avoid, booking and promotion practice, radio and playlist pitching, short video and creators, campuses, diaspora and community networks, ideas from the release. These are "playbook" lines. They cite nothing and may name anything real.
- Every claim about what the audience likes, plays, watches, buys, or where it gathers, is "grounded": it cites the ids of the findings it rests on in findingIds, and names the findings' own candidates. These are measured, so prefer them to your own ideas, and weave them in as the reason for the move ("because this audience plays Rema and Ayra Starr in London"). Never present a name you know but no finding returned as something this audience likes.
- Write for a marketing team, not an analyst. Never use the words lift, index, affinity, cells, Qloo, findings, tested, confidence or data. Say it plainly: "Lagos has the strongest audience of your four cities", "the audience skews older than your target". No scores or decimals.
- Never describe what could not be measured. Every city, sound-alike and choice the team made gets a role and a move. Where the data says little about a city, plan it around community, creator and partner moves, without saying why.
- Never invent a number. Money, ticket sales, streams, chart positions, market sizes and the dates of other releases may be stated only from a web fact in the list, and the line must cite its id in sourceIds. With no web facts, state none of them. Weeks in a timeline and percentages in a budget split are fine.
- Web facts, when listed, are for the release window, rival releases, tour and festival timing, who promotes in these markets, and the scale of the market. Use them to make the timeline and the dates specific. Use only what a fact says. A line that states a web fact is a playbook line with sourceIds; it names no audience taste.
- Pick from the candidates. Leave out any that do not fit the sound or the market, or are not the kind of thing the finding is about, or are global mass-market giants an independent artist would not land (a soft-drink brand), and list each in "skipped" with a short reason.
- Say each thing once. A fact true for every city is one line, not one per city. Never write a line a team could not act on, such as "position the artist around their roots".
- "names": every entity a grounded line recommends because of the audience, exactly as the finding writes it.
- Candidates are listed in the order Qloo ranks them for this audience. Keep that order: lead with the highest-ranked candidate you keep and name the others after it. You may skip a poor fit, but never put a lower-ranked candidate ahead of a higher-ranked one you also name, and never reorder to suit a story.
- Support acts are who this city's audience plays, in Qloo's order. They are not who is free or affordable, so write the ask for the team to make: who to approach and why. Do not propose an act the person already booked.
- A neighbourhood finding says where in a city this audience is strongest. Use the top two or three to place street teams, posters, listening events and creator meet-ups, and name the neighbourhood. Treat it as a lead to confirm on the ground, not a measurement.
- Partner brands in the findings were chosen as brands that could realistically say yes, then ranked by Qloo for the audience. Pick from them in Qloo's order. A brand seldom pays an independent artist in cash. The realistic ask is in kind or a co-promotion: product, ride or data credits, venue or hospitality support, ad space, in return for presence at shows, content and access to the audience. Write it as an ask the team can make: who to approach, what to ask for, what the artist offers. Scale to the budget in the brief; with none given, plan for an independent release.
- Keep it readable: a person should read the whole plan in about five minutes. Each line is one or two sentences, usually under 35 words, with the move first and the reason after it. Put a campus, a series or a partner in a line only when it earns its place: two or three names per city, not every candidate. No caveats stacked inside a line. About 1,200 words in all.
- Never start a line with a label ("Hook:", "Key message:", "Risk:", an artist's name followed by a colon). The group already names it. Write each line as a sentence a strategist would say; a risk and its fix are one sentence.
- Plain, direct words. No exclamation marks, no hype, no hedging. Never mention receipts, call ids, Qloo endpoints or scores.`;

export const PLAN_WRITER_SYSTEM = `You write a launch plan for a music release or tour for Oraqul. You get the person's request, the brief as read, and findings measured in Qloo taste data about the audience of the artist and its sound-alikes.

${RULES}

Sections (write only the ones listed in the request, in that order):
- bottom-line: three moves, the most important first. The first answers where and in what order: start in the home market, the other cities within weeks, naming every one of the team's cities, and where the most spend and community work should go according to the audience data. The next two are the decisions that matter most for this launch, such as the support act to lead with and the single partnership or placement with the biggest pull.
- positioning: the hook (group "Hook"), three key messages (group "Key messages"), and one line per sound-alike artist (group "Comps"), as described above. The hook and messages come from the brief and from what the audience plays, never from invented songs or story.
- audience: who the core and secondary audience are and what they play and watch, by city where it differs. If the audience is older or younger than the team's target, keep the target and say who to lead the creative with.
- markets: one line per team city (group = the city): its role in the release, and the one thing to do there. Then "Worth a look" alternatives, only from the "Worth a look" finding.
- tour: the order of the cities and why. If a finding says another order starts stronger, offer it beside the team's, never instead of it.
- support: for each tour city, the support acts to approach, from that city's finding, and why.
- sync: the series and films this audience watches, as targets for placement and sync pitches, and how to pitch them.
- partnerships: brand and media partners, each tied to the city of its finding, and what the partnership is.
- publicity: podcasts, playlists and press with the angle for each, and the creator plan: which kinds of creators and clip formats, in which cities.
- community: campuses, neighbourhoods and events, and what to run with them.
- creative: two to four hook options for the lead territory, and one key art brief (what the image must show, the tone, what to avoid). Guides only: Oraqul writes the brief and a person makes the trailer, ad or image. Never offer to generate one. Channels, what to measure and the timeline are written by code, so write none of them, and state no targets.
- risks: what could go wrong and what to do. A risk about taste or audience is grounded.`;

export const ANSWER_WRITER_SYSTEM = `You answer a question about a music launch plan for Oraqul, from findings measured in Qloo taste data and your launch knowledge. Two to five lines. Answer the question first.

${RULES}

If the honest answer would change a decision in the plan (a city, the order of cities, the age band, a sound-alike), set changesDecision to true and say what you would change. Do not change the plan yourself: the agent offers to run it as a what-if.`;

export function briefBlock(title: string, read: MusicRead, comps: CompUsed[]): string {
  return [
    `Launch: ${title} (${read.releaseType ?? 'release or tour'})`,
    read.artist ? `Artist: ${read.artist}` : '',
    read.genre ? `Sound: ${read.genre}` : '',
    read.country ? `Country: ${read.country}` : '',
    read.places.length ? `The team's cities, in the order they set: ${read.places.join(', ')}` : '',
    read.ages.length ? `The team's age band: ${agesPhrase(read.ages)}` : '',
    read.gender ? `The team says mostly ${read.gender === 'female' ? 'women' : 'men'}` : '',
    read.window ? `Release or tour window: ${read.window}` : '',
    read.budget
      ? `Marketing budget: ${read.budget.currency}${Math.round(read.budget.amount).toLocaleString('en-US')}`
      : 'No marketing budget given: plan for an independent release',
    read.supportActs.length ? `Support acts already booked: ${read.supportActs.join(', ')}` : '',
    read.featuredActs.length
      ? `Featured on the release or tour: ${read.featuredActs.join(', ')}. Their fans are part of the audience: speak to them, and never invent anything about the music itself.`
      : '',
    read.partners.length ? `Partners already signed: ${read.partners.join(', ')}` : '',
    comps.length
      ? `Sound-alike artists: ${comps.map((c) => `${c.name}${c.source === 'added' ? ' (added by Oraqul)' : ''}`).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** A city's role in plain words, from the verdict on it. */
export function marketRole(verdict: Finding['verdict']): string {
  switch (verdict) {
    case 'holds':
      return 'a lead market: put the biggest date and the most spend there';
    case 'weak':
      return 'a solid market: book it selectively and grow it with local press and campus events';
    case 'breaks':
      return 'a smaller market: keep the date small and lean on creators and community';
    default:
      return 'a community-led market: start with campus, creator and diaspora moves';
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
  const route = byId('f-a-route');
  const withCity = (f: Finding, n = 2) => [...top(f, n), f.context.city ?? ''].filter(Boolean);

  switch (key) {
    case 'bottom-line': {
      const lines: WrittenLine[] = [];
      const [first, ...rest] = teamOrder;
      if (markets && first) {
        lines.push(
          grounded(
            `Start in ${first}${rest.length ? `, then ${list(rest)}` : ''}: that is where the artist's audience is strongest among your cities.`,
            markets,
            teamOrder,
          ),
        );
      } else if (read.places.length) {
        lines.push(
          playbook(`Plan the dates for ${list(read.places)} as you set them.`, read.places),
        );
      }
      const who = audience?.context.audience;
      if (age && read.ages.length) {
        lines.push(
          grounded(
            age.verdict === 'holds' || !who
              ? `Aim the campaign at ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, as planned.`
              : `Keep your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, but lead the creative with ${who}, where this artist is strongest.`,
            audience && who ? audience : age,
            [],
          ),
        );
      } else if (audience && who) {
        lines.push(grounded(`Aim the campaign at ${who}.`, audience, []));
      }
      const support = byQuery('support')[0];
      if (support && input.sections.includes('support')) {
        lines.push(
          grounded(
            `Open the shows with ${list(top(support, 2))}, who rank highest with this audience in ${support.context.city}.`,
            support,
            withCity(support),
          ),
        );
      }
      return lines.slice(0, 3);
    }
    case 'positioning': {
      const comps = input.comps.map((c) => c.name);
      const lines: WrittenLine[] = [
        playbook(
          read.genre ? `Lead with the sound: ${read.genre}.` : 'Lead with the music.',
          [],
          'Hook',
        ),
      ];
      if (comps.length) {
        lines.push(
          playbook(
            `Pitch the artist to press, playlists and promoters in the company of ${list(comps)}.`,
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
      if (age && who && age.verdict !== 'holds' && read.ages.length) {
        lines.push(
          grounded(
            `Your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')} is younger than the artist's core, so keep it for media buying and lead the creative with ${who}.`,
            audience ?? age,
            [],
            'Who they are',
          ),
        );
      }
      for (const f of [...byQuery('shows'), ...byQuery('support')]) {
        const city = f.context.city;
        lines.push(
          grounded(
            `${city ? `In ${city} they` : 'They'} also ${f.query === 'support' ? 'play' : 'watch'} ${list(top(f))}.`,
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
        if (tested) {
          lines.push(
            grounded(`Plan ${city} as ${marketRole(tested.verdict)}.`, tested, [city], city),
          );
        } else {
          lines.push(playbook(`Plan ${city} as you set it.`, [city], city));
        }
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
    case 'tour': {
      if (!route) {
        return [
          playbook(
            teamOrder[0]
              ? `Open in ${teamOrder[0]} and keep the route tight, so travel does not eat the budget.`
              : 'Keep the route tight, so travel does not eat the budget.',
            teamOrder.slice(0, 1),
          ),
        ];
      }
      const best = route.entities.map((e) => e.name);
      return [
        grounded(
          route.verdict === 'holds'
            ? `Keep your order: it already opens with the cities where the audience is strongest.`
            : `Keep your order, or try ${best.join(', then ')}, which opens with the cities where the audience is strongest.`,
          route,
          best,
        ),
      ];
    }
    case 'support': {
      return byQuery('support').map((f) =>
        grounded(
          `In ${f.context.city}, approach ${list(top(f, 2))} to open.`,
          f,
          withCity(f),
          f.context.city,
        ),
      );
    }
    case 'sync': {
      const lines: WrittenLine[] = [];
      const films = byId('f-films');
      if (films) {
        lines.push(
          grounded(
            `Pitch the music to the producers of ${list(top(films))}.`,
            films,
            top(films),
            'Films',
          ),
        );
      }
      for (const f of byQuery('shows')) {
        lines.push(
          grounded(
            `Pitch the music to the music supervisors behind ${list(top(f, 2))} in ${f.context.city}.`,
            f,
            withCity(f),
            'Series',
          ),
        );
      }
      return lines;
    }
    case 'partnerships': {
      const lines: WrittenLine[] = [];
      for (const f of byQuery('brands')) {
        lines.push(
          grounded(`Brands: ${list(top(f, 2))} in ${f.context.city}.`, f, withCity(f), 'Brands'),
        );
      }
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
        lines.push(
          grounded(`Pitch the artist to ${list(top(pods))}.`, pods, top(pods), 'Podcasts'),
        );
      }
      lines.push(
        playbook(
          'Send the record to critics, radio and playlist editors four weeks before release, with a short note on the story.',
          [],
          'Press',
        ),
      );
      return lines;
    }
    case 'community': {
      const areaLines: WrittenLine[] = byQuery('areas').map((f) =>
        grounded(
          `In ${f.context.city}, put the street teams, posters and listening events in ${list(top(f, 2))}.`,
          f,
          withCity(f),
          f.context.city,
        ),
      );
      const lines: WrittenLine[] = byQuery('community').map((f) =>
        grounded(
          `Run a campus listening session or a short set with ${list(top(f, 2))} in ${f.context.city}.`,
          f,
          withCity(f),
          f.context.city,
        ),
      );
      lines.push(
        playbook('Give community partners an early listen and a share-ready clip.', [], null),
      );
      return [...areaLines, ...lines];
    }
    case 'timeline':
      return [
        playbook(
          `T-12 weeks: lock the release plan, artwork and partners${read.window ? `, for ${read.window}` : ''}.`,
        ),
        playbook('T-8 weeks: the lead single and its video, creators briefed.'),
        playbook('T-4 weeks: the record out to press, radio and playlist editors.'),
        playbook('T-1 week: announcements and paid media at full weight.'),
        playbook('Release week: launch events, then report results to partners.'),
      ];
    case 'measure':
      return [
        playbook('Streams and saves by city in the first month.'),
        playbook('Ticket sales by city, week by week.'),
        playbook('Playlist adds and short-video use of the lead single.'),
        playbook('Attendance and sign-ups at community events.'),
      ];
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
              `${name} may sell softer than your other cities: keep the date small and lean on creators and community there.`,
              f,
              [name],
              null,
            ),
          ];
        });
      if (route && (route.verdict === 'weak' || route.verdict === 'breaks')) {
        lines.push(
          grounded(
            'The tour starts with a softer city than it could, so the early shows may feel quiet: keep the order if you must, and put the most promotion into the opening dates.',
            route,
            [],
          ),
        );
      }
      lines.push(
        playbook(
          'A slipped release date: hold the date, and keep the first dates to the cities you can fully support.',
        ),
      );
      return lines;
    }
    default:
      return [];
  }
}

export function sectionTitle(key: LaunchSectionKey): string {
  return musicPlan.SECTION_TITLES[key];
}

export const musicWriterKit: WriterKit<MusicRead> = {
  planSystem: PLAN_WRITER_SYSTEM,
  answerSystem: ANSWER_WRITER_SYSTEM,
  brief: briefBlock,
  templateSection,
};

export class ModelPlanWriter extends LaunchModelWriter<MusicRead> {
  constructor(model: LanguageModel, timeoutMs: number, options: ProviderOptions = {}) {
    super(model, timeoutMs, musicWriterKit, options);
  }
}

/** Falls back to the template writer when the model fails, so a plan never stops at writing. */
export class FallbackPlanWriter extends LaunchFallbackWriter<MusicRead> {}

export class TemplatePlanWriter extends LaunchTemplateWriter<MusicRead> {
  constructor() {
    super(musicWriterKit);
  }
}
