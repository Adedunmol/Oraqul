import { podcastsPlan } from '@oraqul/packs';
import type { CompUsed, Finding, LaunchSectionKey } from '@oraqul/schema';
import type { LanguageModel } from 'ai';
import type { ProviderOptions } from '../../llm/llm.js';
import { slug } from '../launch/brief.js';
import { agesPhrase, capitalise, list } from '../launch/findings.js';
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
import { formatOf, kindOf, platformsOf } from './launch-kind.js';
import type { PodcastsRead } from './read.js';

const { KIND_PROFILES, PLATFORM_LABEL } = podcastsPlan;

export type WriteInput = LaunchWriteInput<PodcastsRead>;
export type AnswerInput = LaunchAnswerInput<PodcastsRead>;
export type PlanWriter = LaunchPlanWriter<PodcastsRead>;

export const RULES = `How to write:
- You are a senior podcast launch strategist. Write the plan a network or an independent studio would act on this week. Decisions with reasons: each line is the move, why, and how, in one to three sentences. Be specific: names, markets, weeks, who does what.
- Answer what the person asked, using everything they gave. Their markets, platforms, launch kind, format, age band, comparable shows, topics, sponsors, swap partners and window are decisions to plan for, not hypotheses to replace. If the audience data shows one is weak, keep it, say so plainly, and say what to do about it.
- What you know about the show is only what the person wrote: the title, the subject, the style, the hosts, the format and the audience. Never describe its episodes, stories or guests beyond that.
- The audience data ranks the person's markets by where the show's listeners are densest. A market that ranks lower can still be strong for community or swaps: never call a market a weak or poor market. Use the ranking for where the spend and the live events go.
- Every comparable show the person named gets its own line: what it signals to listeners and press, and how close a match it is. If you are not sure what a show is, say only what you are sure of.
- Use your launch knowledge freely: the trailer and the feed, launching with several episodes, ratings and reviews in the first week, editorial pitches to the platforms, guest and trailer swaps, newsletters, clips for social and video, live recordings, sponsor reads. These are "playbook" lines. They cite nothing and may name anything real. Call the people who hear the show listeners, never fans, in a playbook line.
- Every claim about what the listeners like, follow, hear, watch or buy, or where they gather, is "grounded": it cites the ids of the findings it rests on in findingIds, and names the findings' own candidates. These are measured, so prefer them to your own ideas, and weave them in as the reason for the move ("because these listeners hear Crime Junkie and Casefile"). Never present a name you know but no finding returned as something these listeners like.
- The topic map compares your listeners with the listeners of rival shows. A topic that is "yours" is one your listeners lean to more than the rival shows' listeners: build the positioning and the episode angles on those. A topic the team wanted that is shared or the rivals' keeps its place: say plainly it is not yours alone and what angle to take on it. Never tell the team to drop a topic.
- Cross promotion shows are the shows these listeners already hear. Name the best ones in order. A show the person named gets its own line: if it ranks high, say how to use it; if it ranks low, keep it and say which to add beside it.
- When the brief says who the show is made for by language, culture or community ("Made for"), Qloo cannot measure that, so you cover it from your own knowledge, as playbook lines: the language of the feed and the description, the newsletters, communities and media that reach that audience, the platforms and apps people there use to hear shows, data costs, and how people in that market discover shows. Name real places and platforms you are sure of, and say nothing you are unsure of. Never claim what that audience likes or follows without a finding, never stereotype, and write about the people the way they would write about themselves.
- Qloo holds no host or guest data unless a finding says so. Without a guests finding, every guest line is playbook: the kinds of guest, how to ask and how to record. Never name a guest you know as someone these listeners follow.
- Write for a marketing team, not an analyst. Never use the words lift, index, affinity, cells, overlap, Qloo, findings, tested, confidence or data. Say it plainly: "Lagos has the strongest audience of your markets", "the listeners skew older than your target". No scores or decimals.
- Never describe what could not be measured. Every market, comparable show and choice the team made gets a role and a move. Where the data says little about a market, plan it around community and swaps, without saying why.
- Never invent a number. Downloads, listeners, chart positions, ad rates, money, and the dates of other releases may be stated only from a web fact in the list, and the line must cite its id in sourceIds. With no web facts, state none of them. Weeks before launch and percentages in a budget split are fine.
- Web facts, when listed, are for chart and editorial windows, rival releases, sponsor norms and where this kind of show launches. Use them to make the plan's dates specific. Use only what a fact says. A line that states a web fact is a playbook line with sourceIds; it names no audience taste.
- Pick from the candidates. Leave out any that do not fit the subject or the audience, or are global mass-market giants a new show would not land (a soft-drink brand), and list each in "skipped" with a short reason.
- Say each thing once. A fact true for every market is one line, not one per market. Never write a line a team could not act on, such as "position the show around its heart".
- "names": every entity a grounded line recommends because of the audience, exactly as the finding writes it.
- Candidates are listed in the order Qloo ranks them for these listeners. Keep that order: lead with the highest-ranked candidate you keep and name the others after it. You may skip a poor fit, but never put a lower-ranked candidate ahead of a higher-ranked one you also name.
- Sponsors in the findings were chosen as brands that could realistically say yes, then ranked for the listeners. Pick from them in order. A brand seldom pays a new independent show in cash. The realistic ask is in kind or a co-promotion: product, credits, giveaways, ad space, in return for presence and access to the listeners. Scale to the budget in the brief; with none given, plan for an independent show.
- Keep it readable: a person should read the whole plan in about five minutes. Each line is one or two sentences, usually under 35 words, with the move first and the reason after it. No caveats stacked inside a line. About 1,200 words in all.
- Never start a line with a label ("Hook:", "Risk:", a show's name followed by a colon). The group already names it. Write each line as a sentence a strategist would say; a risk and its fix are one sentence.
- Plain, direct words. No exclamation marks, no hype, no hedging. Never mention receipts, call ids, Qloo endpoints or scores.`;

export const PLAN_WRITER_SYSTEM = `You write a launch plan for a podcast for Oraqul. You get the person's request, the brief as read, and findings measured in Qloo taste data about the audience of the show and its comparable shows.

${RULES}

Sections (write only the ones listed in the request, in that order):
- bottom-line: three moves, the most important first. The first answers where to lead: the market or markets where the audience is strongest among the team's, and where the most spend and live work should go. The next two are the decisions that matter most for this launch, such as the swap with the biggest pull and the topic to build the positioning on.
- positioning: the hook (group "Hook"), three key messages (group "Key messages"), and one line per comparable show (group "Comps"). The hook and messages come from the brief, the topics that are yours and what the listeners like, never from an invented story.
- audience: who the core and secondary audience are and what else they hear, watch and follow. If the audience is older or younger than the team's target, keep the target and say who to lead the creative with.
- markets: one line per team market (group = the market): its role in the launch, and the one thing to do there. Then "Worth a look" alternatives, only from the "Worth a look" finding. When the team named no market, write the lead markets from the markets finding.
- crosspromo: the shows to swap trailers, ads or guests with, in the order of the findings, and how to ask. A show the team named gets its own line.
- guests: the kinds of guest, how to ask and how to record. Playbook unless a guests finding exists.
- partnerships: sponsors, each tied to the city of its finding, and what the sponsorship is.
- publicity: newsletters, press and the editorial pitches to the platforms, with the angle for each. Use the artists and series listeners follow only as episode angles, from the findings.
- video: clips and full episodes for YouTube and social, and what to cut. Playbook.
- live: live recordings and meet-ups in the best markets, from the markets finding.
- community: where listeners gather and what to run there.
- cadence: how often to release, how long episodes run and when the season ends, for the show's style. Playbook.
- risks: what could go wrong and what to do. A risk about taste, topics or audience is grounded.
Launch beats, the budget split and what would sharpen the plan are written by code. Do not write them.`;

export const ANSWER_WRITER_SYSTEM = `You answer a question about a podcast launch plan for Oraqul, from findings measured in Qloo taste data and your launch knowledge. Two to five lines. Answer the question first.

${RULES}

If the honest answer would change a decision in the plan (a market, a platform, the age band, a comparable show, a topic, a swap), set changesDecision to true and say what you would change. Do not change the plan yourself: the agent offers to run it as a what-if.`;

export function briefBlock(title: string, read: PodcastsRead, comps: CompUsed[]): string {
  const { kind, assumed } = kindOf(read);
  const { format, assumed: formatAssumed } = formatOf(read);
  const named = platformsOf(read);
  return [
    `Launch: ${title} (${KIND_PROFILES[kind].label}${assumed ? ', assumed because the brief does not say' : ''})`,
    read.show ? `Show: ${read.show}` : '',
    read.genre ? `Subject: ${read.genre}` : '',
    read.style ? `Style: ${read.style}` : '',
    `Format: ${format}${formatAssumed ? ' (assumed)' : ''}`,
    `Platforms: ${named.map((p) => PLATFORM_LABEL[p]).join(', ')}${read.platforms.length ? '' : ' (assumed)'}`,
    read.country ? `Producer country: ${read.country}` : '',
    read.regions.length ? `The team's markets: ${read.regions.join(', ')}` : '',
    read.places.length
      ? `The team's markets as cities, in the order they set: ${read.places.join(', ')}`
      : '',
    read.ages.length ? `The team's age band: ${agesPhrase(read.ages)}` : '',
    read.gender ? `The team says mostly ${read.gender === 'female' ? 'women' : 'men'}` : '',
    read.window ? `Release window: ${read.window}` : 'No release date given',
    read.budget
      ? `Marketing budget: ${read.budget.currency}${Math.round(read.budget.amount).toLocaleString('en-US')}`
      : 'No marketing budget given: plan for an independent show',
    read.hosts.length ? `Hosts: ${read.hosts.join(', ')}` : '',
    read.guests.length ? `Guests booked or wanted: ${read.guests.join(', ')}` : '',
    read.topics.length ? `Topics the team wants to own: ${read.topics.join(', ')}` : '',
    read.previousShows.length ? `Earlier shows by the team: ${read.previousShows.join(', ')}` : '',
    read.crossPromo.length
      ? `Shows the team wants to swap with: ${read.crossPromo.join(', ')}`
      : '',
    read.rivals.length ? `Rival shows: ${read.rivals.join(', ')}` : '',
    read.audienceNote
      ? `Made for: ${read.audienceNote}. Qloo cannot measure this, so use your own knowledge of it in playbook lines.`
      : '',
    read.partners.length ? `Sponsors and partners already signed: ${read.partners.join(', ')}` : '',
    comps.length
      ? `Comparable shows: ${comps.map((c) => `${c.name}${c.source === 'added' ? ' (added by Oraqul)' : ''}`).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** A market's role in plain words, from the verdict on it. */
export function marketRole(verdict: Finding['verdict']): string {
  switch (verdict) {
    case 'holds':
      return 'a lead market: put the most spend and the first live recording there';
    case 'weak':
      return 'a solid market: grow it with swaps and community events';
    case 'breaks':
      return 'a smaller market: keep the spend small and lean on swaps and community';
    default:
      return 'a community-led market: start with swaps and community moves';
  }
}

/** A swap partner the team named, in plain words: use it if it ranks high, add beside it if not. */
function swapLine(promo: Finding, shows: Finding | undefined): WrittenLine {
  const name = promo.entities[0]?.name ?? 'the show';
  const place = promo.numbers.place ?? 1;
  const of = promo.numbers.of ?? 1;
  const better = (shows?.entities ?? [])
    .filter((e) => e.name !== name)
    .slice(0, 2)
    .map((e) => e.name);
  const strong = of < 3 || place <= Math.ceil(of / 3);
  return strong
    ? grounded(`Take the swap with ${name} forward: ${promo.text}`, promo, [name], 'Your pick')
    : grounded(
        better.length
          ? `Keep the swap with ${name}, and approach ${list(better)} too: they rank higher with your listeners.`
          : `Keep the swap with ${name}, and add a second show in the same genre: it ranks low with your listeners.`,
        promo,
        [name, ...better],
        'Your pick',
      );
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
  const topics = byId('f-topics');
  const mine = topics?.entities.filter((e) => e.detail?.startsWith('yours')).map((e) => e.name);
  const withCity = (f: Finding, n = 2) => [...top(f, n), f.context.city ?? ''].filter(Boolean);
  const shows = byId('f-crosspromo');
  const promos = byQuery('crosspromo').filter((f) => f.id.startsWith('f-promo-'));
  const { kind } = kindOf(read);
  const { format } = formatOf(read);

  switch (key) {
    case 'bottom-line': {
      const lines: WrittenLine[] = [];
      const [first, ...rest] = teamOrder;
      if (markets && first) {
        const next = rest.slice(0, 2);
        lines.push(
          grounded(
            `Lead with ${first}${next.length ? `, then ${list(next)}` : ''}: that is where your show's listeners are strongest${rest.length > 2 ? ' of the markets checked' : ''}.`,
            markets,
            [first, ...next],
          ),
        );
      } else if (read.places.length) {
        lines.push(playbook(`Plan ${list(read.places)} as you set them.`, read.places));
      }
      const who = audience?.context.audience;
      if (age && read.ages.length) {
        lines.push(
          grounded(
            age.verdict === 'holds' || !who
              ? `Aim the launch at ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, as planned.`
              : `Keep your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, but lead the creative with ${who}, where this show is strongest.`,
            audience && who ? audience : age,
            [],
          ),
        );
      } else if (audience && who) {
        lines.push(grounded(`Aim the launch at ${who}.`, audience, []));
      }
      if (topics && mine?.length) {
        lines.push(
          grounded(
            `Build the positioning on ${list(mine.slice(0, 2).map((t) => t.toLowerCase()))}: your listeners lean to it more than the listeners of rival shows do.`,
            topics,
            [],
          ),
        );
      } else if (promos[0] ?? shows) {
        const pick = promos[0];
        lines.push(
          pick
            ? swapLine(pick, shows)
            : grounded(
                `Start swap talks with ${list(top(shows as Finding, 2))}, who rank highest with your listeners.`,
                shows as Finding,
                top(shows as Finding, 2),
              ),
        );
      }
      return lines.slice(0, 3);
    }
    case 'positioning': {
      const comps = input.comps.map((c) => c.name);
      const lines: WrittenLine[] = [
        ...(read.audienceNote
          ? [
              playbook(
                `Make the feed, the show description and the artwork feel made for ${read.audienceNote}, in their language where the show allows it.`,
                [],
                'Audience',
              ),
            ]
          : []),
        playbook(
          read.genre
            ? `Name the subject, ${read.genre}, in the first line of the show description and in the first thirty seconds of the trailer.`
            : 'Name the subject in the first line of the show description and in the first thirty seconds of the trailer.',
          [],
          'Hook',
        ),
      ];
      if (topics && mine?.length) {
        lines.push(
          grounded(
            `Lead the key messages with ${list(mine.slice(0, 3).map((t) => t.toLowerCase()))}, the topics your listeners lean to that rival shows do not.`,
            topics,
            [],
            'Key messages',
          ),
        );
      }
      if (comps.length) {
        lines.push(
          playbook(
            `Pitch the show to press, newsletters and listeners in the company of ${list(comps)}.`,
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
            `Your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')} differs from the show's core, so keep it for media buying and lead the creative with ${who}.`,
            audience ?? age,
            [],
            'Who they are',
          ),
        );
      }
      if (shows) {
        lines.push(
          grounded(
            `They also hear ${list(top(shows, 2))}.`,
            shows,
            top(shows, 2),
            'What else they follow',
          ),
        );
      }
      for (const f of byQuery('crossover').slice(0, 2)) {
        const verb = f.id.endsWith('series') ? 'watch' : 'listen to';
        lines.push(
          grounded(`They also ${verb} ${list(top(f, 2))}.`, f, top(f, 2), 'What else they follow'),
        );
      }
      return lines;
    }
    case 'markets': {
      const lines: WrittenLine[] = [];
      if (read.places.length) {
        for (const place of teamOrder) {
          const tested = byId(`f-a-place-${slug(place)}`);
          lines.push(
            tested
              ? grounded(`Plan ${place} as ${marketRole(tested.verdict)}.`, tested, [place], place)
              : playbook(`Plan ${place} as you set it.`, [place], place),
          );
        }
      } else if (markets) {
        lines.push(grounded(markets.text, markets, teamOrder));
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
    case 'crosspromo': {
      const lines: WrittenLine[] = promos.map((f) => swapLine(f, shows));
      if (shows) {
        lines.push(
          grounded(
            `Offer a trailer swap or a guest slot to ${list(top(shows, 3))}: they rank highest with your listeners.`,
            shows,
            top(shows, 3),
            'Who',
          ),
        );
      }
      lines.push(
        playbook(
          'Record the swaps before launch and release them in the first two weeks, so each show sends its listeners while the feed is new.',
          [],
          'How',
        ),
      );
      return lines;
    }
    case 'guests': {
      const lines: WrittenLine[] = [];
      const guests = byId('f-guests');
      if (guests) {
        lines.push(
          grounded(
            `Start guest outreach with ${list(top(guests, 3))}, who rank highest with your listeners.`,
            guests,
            top(guests, 3),
            'Who',
          ),
        );
      }
      if (read.guests.length) {
        lines.push(
          playbook(
            `Book ${list(read.guests)} first and record them before launch.`,
            read.guests,
            'Already named',
          ),
        );
      }
      lines.push(
        playbook(
          'Open with guests who bring their own audience, and ask each to share the episode on the day it goes out.',
          [],
          'How',
        ),
      );
      return lines;
    }
    case 'partnerships': {
      const lines: WrittenLine[] = [];
      for (const f of byQuery('brands')) {
        lines.push(
          grounded(
            `Approach ${list(top(f, 2))}${f.context.city ? ` in ${f.context.city}` : ''} for an in-kind sponsorship or a co-promotion: they rank highest with your listeners.`,
            f,
            withCity(f),
            'Sponsors',
          ),
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
      for (const f of byQuery('crossover').slice(0, 2)) {
        lines.push(
          grounded(
            `Pitch episode angles that tie to ${list(top(f, 2))}, which these listeners follow.`,
            f,
            top(f, 2),
            f.id.endsWith('series') ? 'Series' : 'Music',
          ),
        );
      }
      lines.push(
        playbook(
          'Send the platforms an editorial pitch six weeks out, and a short note with a link to the trailer to newsletters and press in your subject.',
          [],
          'Press',
        ),
      );
      return lines;
    }
    case 'video':
      return [
        playbook(
          format === 'video'
            ? 'Publish every episode in full on YouTube, and cut a clip of the strongest minute for social the same day.'
            : 'Publish a clip of the strongest minute of each episode with captions, and the full episodes on YouTube.',
          [],
          'Clips',
        ),
      ];
    case 'live': {
      const first = teamOrder[0];
      const lines: WrittenLine[] = [];
      if (markets && first) {
        lines.push(
          grounded(
            `Plan a live recording or a listener meet-up in ${first}, where your listeners are strongest.`,
            markets,
            [first],
            first,
          ),
        );
      } else if (read.places[0]) {
        lines.push(playbook(`Plan a live recording in ${read.places[0]}.`, [read.places[0]]));
      }
      return lines;
    }
    case 'community':
      return [
        playbook(
          'Open a listener channel before the first episode goes out, and give its first members early access to the trailer.',
          [],
          'Community',
        ),
      ];
    case 'cadence':
      return [
        playbook(
          read.style === 'news'
            ? 'Release on weekdays at one fixed time, and keep each episode short enough to hear in one sitting.'
            : read.style === 'narrative'
              ? 'Release weekly after the first batch, and tell people the season length up front so they know when it ends.'
              : 'Release weekly on one fixed day, and keep every episode in the same range of length so the feed feels reliable.',
          [],
          'Schedule',
        ),
      ];
    case 'measure':
      return KIND_PROFILES[kind].measures.map((m) => playbook(`Track ${m.toLowerCase()}.`));
    case 'risks': {
      const lines: WrittenLine[] = findings
        .filter((f) => f.verdict === 'weak' || f.verdict === 'breaks')
        .flatMap((f) => {
          if (f.id.startsWith('f-a-place-')) {
            const place = f.id.replace('f-a-place-', '');
            const name = read.places.find((p) => slug(p) === place) ?? place;
            return [
              grounded(
                `${name} may grow slower than your other markets: keep the spend small and lean on swaps and community there.`,
                f,
                [name],
                null,
              ),
            ];
          }
          if (f.id.startsWith('f-a-topic-')) {
            const topic = f.id.replace('f-a-topic-', '');
            const name = read.topics.find((t) => slug(t) === topic) ?? topic;
            return [
              grounded(
                `${capitalise(name)} is not a topic only your listeners lean to, so take an angle on it that the rival shows do not.`,
                f,
                [],
              ),
            ];
          }
          return [];
        });
      lines.push(
        playbook(
          'A slipped launch date: hold the date once the trailer is public, and record the first episodes before announcing it.',
        ),
      );
      return lines;
    }
    default:
      return [];
  }
}

export function sectionTitle(key: LaunchSectionKey): string {
  return podcastsPlan.SECTION_TITLES[key];
}

export const podcastsWriterKit: WriterKit<PodcastsRead> = {
  planSystem: PLAN_WRITER_SYSTEM,
  answerSystem: ANSWER_WRITER_SYSTEM,
  brief: briefBlock,
  templateSection,
};

export class ModelPlanWriter extends LaunchModelWriter<PodcastsRead> {
  constructor(model: LanguageModel, timeoutMs: number, options: ProviderOptions = {}) {
    super(model, timeoutMs, podcastsWriterKit, options);
  }
}

/** Falls back to the template writer when the model fails, so a plan never stops at writing. */
export class FallbackPlanWriter extends LaunchFallbackWriter<PodcastsRead> {}

export class TemplatePlanWriter extends LaunchTemplateWriter<PodcastsRead> {
  constructor() {
    super(podcastsWriterKit);
  }
}
