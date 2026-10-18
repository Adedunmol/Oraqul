import { filmPlan } from '@oraqul/packs';
import {
  type CompUsed,
  type Finding,
  type LaunchSectionKey,
  launchSectionKeys,
  lineKindSchema,
  type PlanSource,
} from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { ProviderOptions } from '../../llm/llm.js';
import { slug } from './brief.js';
import { agesPhrase, list } from './findings.js';
import type { FilmRead } from './read.js';

const { SECTION_TITLES } = filmPlan;

/** A line as the writer gives it, before code checks it and gives it an id. */
export const writtenLineSchema = z.object({
  kind: lineKindSchema,
  text: z.string().min(1),
  findingIds: z.array(z.string()),
  /** The web facts the line states, by id. Empty when it states none. */
  sourceIds: z.array(z.string()),
  names: z.array(z.string()),
  group: z.string().nullable(),
});
export type WrittenLine = z.infer<typeof writtenLineSchema>;

export const writtenSectionSchema = z.object({
  key: z.enum(launchSectionKeys),
  lines: z.array(writtenLineSchema),
});
export type WrittenSection = z.infer<typeof writtenSectionSchema>;

const writtenPlanSchema = z.object({
  sections: z.array(writtenSectionSchema),
  /** Candidates the writer left out as off-genre or off-brief, with a reason for each. */
  skipped: z.array(z.object({ name: z.string(), why: z.string() })),
});

const writtenAnswerSchema = z.object({
  lines: z.array(writtenLineSchema),
  /** True when the answer would change a decision in the plan, so the agent offers a what-if. */
  changesDecision: z.boolean(),
});

export interface WriteInput {
  title: string;
  /** The person's own words: the brief and its files, as sent. */
  request: string;
  read: FilmRead;
  comps: CompUsed[];
  /** The sections to write, core first. Gaps and Budget split are written by code. */
  sections: LaunchSectionKey[];
  findings: Finding[];
  /** Facts found on the web, each with an id a line may cite. Empty when search is off. */
  sources: PlanSource[];
}

export interface AnswerInput {
  title: string;
  read: FilmRead;
  question: string;
  /** The plan's lines as plain text, for context. */
  plan: string;
  chat: string;
  findings: Finding[];
}

export interface PlanWriter {
  write(input: WriteInput): Promise<{
    sections: WrittenSection[];
    skipped: { name: string; why: string }[];
    tokens: number;
    by: 'model' | 'template';
  }>;
  answer(input: AnswerInput): Promise<{
    lines: WrittenLine[];
    changesDecision: boolean;
    tokens: number;
    by: 'model' | 'template';
  }>;
}

/** Sections code writes itself: Gaps from what was not tested, Budget split from the convention. */
export const CODE_SECTIONS: LaunchSectionKey[] = ['gaps', 'budget'];

const RULES = `How to write:
- You are a senior film and series launch strategist. Write the plan a distributor, a financier or a partner would act on this week. Decisions with reasons: each line is the move, why, and how, in one to three sentences. Be specific: names, places, weeks, who does what.
- Answer what the person asked, using everything they gave. Their cities, age band, comps and window are decisions to plan for, not hypotheses to replace. If the audience data shows one is weak, keep it, say so plainly, and say what to do about it.
- What you know about the film is only what the person wrote: its genre, country, cities, audience and comps. Never describe its plot, characters, themes, tone or cast beyond that. The themes and archetypes in the data are what the comps' audience responds to: you may say the campaign should speak to them ("lean into power, loyalty and survival"), never that the film contains them.
- The audience data ranks the person's cities by where the comps' audience is densest, for these comps. A city that ranks lower for the comps can still be strong for the film's music or for diaspora community work: if the music and community findings for it are strong, lead with those there, and never call a city a weak or poor market. Use the ranking for where the spend, the extra screens and the community work go. It is not the order to premiere: a film premieres in its home market (for a Nigerian film, Lagos), and the other cities follow within days so piracy and spoilers do not get there first.
- Every comp the person named gets its own line: what it signals to buyers and press, and how strong a comp it is for this film. If you are not sure what a comp is, say only what you are sure of. If a comp was a streaming release or a different genre, say so, and say what that means for how the film is sold.
- Use your launch knowledge freely: release windows and the seasons to avoid, distribution and exhibition partners, classification, piracy, festival and premiere strategy, creators and short-form clips, a soundtrack single, campuses, diaspora and community networks, ideas from the title, group bookings. These are "playbook" lines. They cite nothing and may name anything real.
- Every claim about what the audience likes, watches, plays, buys, or where it gathers, is "grounded": it cites the ids of the findings it rests on in findingIds, and names the findings' own candidates. These are measured, so prefer them to your own ideas, and weave them in as the reason for the move ("because this audience plays Tems and Rema in Lagos"). Never present a name you know but no finding returned as something this audience likes.
- Write for a marketing team, not an analyst. Never use the words lift, index, affinity, cells, Qloo, findings, tested, confidence or data. Say it plainly: "Houston has the strongest audience of your four cities", "the audience skews older than your target". No scores or decimals.
- Never describe what could not be measured. Every city, comp and choice the team made gets a role and a move. Where the data says little about a city, plan it around community, partner and diaspora moves, without saying why.
- Never invent a number. Money, box office, admissions, market sizes and the dates of other releases may be stated only from a web fact in the list, and the line must cite its id in sourceIds. With no web facts, state none of them. Weeks in a timeline and percentages in a budget split are fine.
- Web facts, when listed, are for the release window, rival releases, who distributes and shows films like this, and the scale of the market. Use them to make the route, timeline and placement specific ("avoid the weeks around X, when Y opens"). Use only what a fact says. A line that states a web fact is a playbook line with sourceIds; it names no audience taste.
- Pick from the candidates. Leave out any that do not fit the genre, tone or market, or are not the kind of thing the finding is about (a hotel in a list of cinemas), or are global mass-market giants an independent film would not land (a soft-drink brand), or are not a fit for a film tie-in (a calling app), and list each in "skipped" with a short reason.
- Say each thing once. A fact true for every city is one line, not one per city. Never write a line a team could not act on, such as "position the film around its roots".
- "names": every entity a grounded line recommends because of the audience, exactly as the finding writes it.
- Brand partnerships are asks, so say who gives what. A brand seldom pays an independent film in cash. The realistic ask is in kind or a co-promotion: product, a venue or hospitality, ticket giveaways, data or ride credits, ad space or airtime, in return for premiere presence, stills, clip rights and access to the film's audience. A global giant or a luxury brand will not partner on a small campaign, so leave it out and prefer a challenger, local or category brand the findings return; if none fits, say so rather than naming a poor fit. Write it as an ask a producer can make: who to approach, what to ask for, what the film offers. Scale to the budget in the brief; with none given, plan for an independent release.
- Keep it readable: a person should read the whole plan in about five minutes. Each line is one or two sentences, usually under 35 words, with the move first and the reason after it. Put a venue, a church or a partner in a line only when it earns its place: two or three names per city, not every candidate. No caveats stacked inside a line; if something needs approval or a licence, say it once, briefly. About 1,200 words in all.
- Never start a line with a label ("Hook:", "Key message:", "Risk:", a comp's name followed by a colon). The group already names it. Write each line as a sentence a strategist would say; a risk and its fix are one sentence.
- Only use themes that fit a crime thriller. The data lists whatever this audience responds to, including off-genre words: leave those out.
- Plain, direct words. No exclamation marks, no hype, no hedging. Never mention receipts, call ids, Qloo endpoints or scores.`;

export const PLAN_WRITER_SYSTEM = `You write a launch plan for a film or series for Oraqul. You get the person's request, the brief as read, and findings measured in Qloo taste data about the audience of the comps.

${RULES}

Sections (write only the ones listed in the request, in that order):
- bottom-line: three moves, the most important first. The first answers where and in what order: premiere in the home market, the other cities within days, naming every one of the team's cities, and where the most spend and community work should go according to the audience data. The next two are the decisions that matter most for this launch, such as who to lead the creative with and the single partnership or placement with the biggest pull.
- positioning: the hook (group "Hook"), three key messages (group "Key messages"), and one line per comp (group "Comps"), as described above. The hook and messages come from the brief and from what the audience responds to, never from invented plot.
- audience: who the core and secondary audience are and what they like, by city where it differs. If the comps' audience is older or younger than the team's target, keep the target and say who to lead the creative with.
- markets: one line per team city (group = the city): its role in the release, where to screen, and the one thing to do there. Then "Worth a look" alternatives, only from the "Worth a look" finding.
- partnerships: music, brand and media partners, each tied to the city of its finding, and what the partnership is.
- placement: which films and series to attach the trailer and ads to, and why.
- publicity: podcasts, shows and press with the angle for each, and the creator plan: which kinds of creators and clip formats, in which cities, and how they get the film.
- community: churches, campuses, associations and events, and what to run with them.
- route: the release route and window, what to hold back for after the cinema run, and the case for opening the cities within days of each other.
- timeline: the launch in weeks before release (T-12, T-8, T-4, T-1, opening, after), each with its concrete tasks. Real dates only if the brief gives a date.
- cadence: binge, weekly or hybrid, for a series only.
- measure: what to track, by name, no targets.
- risks: what could go wrong and what to do. A risk about taste or audience is grounded.`;

export const ANSWER_WRITER_SYSTEM = `You answer a question about a film or series launch plan for Oraqul, from findings measured in Qloo taste data and your launch knowledge. Two to five lines. Answer the question first.

${RULES}

If the honest answer would change a decision in the plan (a city, the order of cities, the age band, a comp), set changesDecision to true and say what you would change. Do not change the plan yourself: the agent offers to run it as a what-if.`;

function findingsBlock(findings: Finding[]): string {
  return findings
    .map(
      (f) =>
        `[${f.id}] ${f.text}${f.entities.length ? ` Candidates: ${f.entities.map((e) => (e.detail ? `${e.name} (${e.detail})` : e.name)).join('; ')}.` : ''} Confidence ${f.confidence}.`,
    )
    .join('\n');
}

function sourcesBlock(sources: PlanSource[]): string {
  return sources.map((s) => `[${s.id}] ${s.fact} (${s.title})`).join('\n');
}

function briefBlock(title: string, read: FilmRead, comps: CompUsed[]): string {
  return [
    `Launch: ${title} (${read.format ?? 'film or series'})`,
    read.genre ? `Genre: ${read.genre}` : '',
    read.logline ? `About: ${read.logline}` : '',
    read.country ? `Country of origin: ${read.country}` : '',
    read.language ? `Language: ${read.language}` : '',
    read.places.length ? `The team's cities: ${read.places.join(', ')}` : '',
    read.ages.length ? `The team's age band: ${agesPhrase(read.ages)}` : '',
    read.gender ? `The team says mostly ${read.gender === 'female' ? 'women' : 'men'}` : '',
    read.window ? `Release window: ${read.window}` : '',
    read.budget
      ? `Marketing budget: ${read.budget.currency}${Math.round(read.budget.amount).toLocaleString('en-US')}`
      : 'No marketing budget given: plan for an independent release',
    read.route ? `Release route: ${read.route}` : '',
    read.cast.length ? `Cast: ${read.cast.join(', ')}` : '',
    read.director ? `Director: ${read.director}` : '',
    read.soundtrack.length ? `Soundtrack: ${read.soundtrack.join(', ')}` : '',
    read.partners.length ? `Partners already signed: ${read.partners.join(', ')}` : '',
    comps.length
      ? `Comps: ${comps.map((c) => `${c.name}${c.source === 'added' ? ' (added by Oraqul)' : ''}`).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export class ModelPlanWriter implements PlanWriter {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
    /** Provider settings, such as how hard a reasoning model thinks before writing. */
    private readonly options: ProviderOptions = {},
  ) {}

  async write(input: WriteInput) {
    const wanted = input.sections.filter((s) => !CODE_SECTIONS.includes(s));
    const { output, usage } = await generateText({
      model: this.model,
      system: PLAN_WRITER_SYSTEM,
      prompt: [
        'The request, as the person wrote it:',
        input.request,
        '',
        'The brief as read:',
        briefBlock(input.title, input.read, input.comps),
        '',
        `Write these sections, in order: ${wanted.join(', ')}.`,
        '',
        'Findings:',
        findingsBlock(input.findings),
        ...(input.sources.length ? ['', 'Web facts:', sourcesBlock(input.sources)] : []),
      ].join('\n'),
      output: Output.object({ schema: writtenPlanSchema }),
      providerOptions: this.options,
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return {
      sections: output.sections,
      skipped: output.skipped,
      tokens: usage.totalTokens ?? 0,
      by: 'model' as const,
    };
  }

  async answer(input: AnswerInput) {
    const { output, usage } = await generateText({
      model: this.model,
      system: ANSWER_WRITER_SYSTEM,
      prompt: [
        briefBlock(input.title, input.read, []),
        '',
        'The plan:',
        input.plan,
        '',
        'Chat so far:',
        input.chat,
        '',
        'Findings:',
        findingsBlock(input.findings),
        '',
        `Question: ${input.question}`,
      ].join('\n'),
      output: Output.object({ schema: writtenAnswerSchema }),
      providerOptions: this.options,
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { ...output, tokens: usage.totalTokens ?? 0, by: 'model' as const };
  }
}

/** Falls back to the template writer when the model fails, so a plan never stops at writing. */
export class FallbackPlanWriter implements PlanWriter {
  constructor(
    private readonly primary: PlanWriter,
    private readonly fallback: PlanWriter,
    private readonly onError: (err: unknown) => void,
  ) {}

  async write(input: WriteInput) {
    try {
      return await this.primary.write(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.write(input);
    }
  }

  async answer(input: AnswerInput) {
    try {
      return await this.primary.answer(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.answer(input);
    }
  }
}

const grounded = (
  text: string,
  finding: Finding,
  names: string[],
  group: string | null = null,
): WrittenLine => ({
  kind: 'grounded',
  text,
  findingIds: [finding.id],
  sourceIds: [],
  names,
  group,
});

const playbook = (
  text: string,
  names: string[] = [],
  group: string | null = null,
): WrittenLine => ({
  kind: 'playbook',
  text,
  findingIds: [],
  sourceIds: [],
  names,
  group,
});

/**
 * Writes the plan from templates, for runs with no model key, a failed call and the evals. It
 * names the findings' top candidates as they are, with no judgment of genre or tone.
 */
export class TemplatePlanWriter implements PlanWriter {
  async write(input: WriteInput) {
    const sections = input.sections
      .filter((key) => !CODE_SECTIONS.includes(key))
      .map((key) => ({ key, lines: templateSection(key, input) }));
    return { sections, skipped: [], tokens: 0, by: 'template' as const };
  }

  async answer(input: AnswerInput) {
    const words = new Set(input.question.toLowerCase().match(/\p{L}{4,}/gu) ?? []);
    const scored = input.findings
      .map((f) => ({
        f,
        score: [...words].filter((w) => f.text.toLowerCase().includes(w)).length,
      }))
      .sort((a, b) => b.score - a.score);
    const picked = scored
      .filter((s) => s.score > 0)
      .slice(0, 3)
      .map((s) => s.f);
    const use = picked.length ? picked : input.findings.slice(0, 2);
    const lines = use.map((f) =>
      grounded(
        f.text,
        f,
        f.entities.slice(0, NAMED).map((e) => e.name),
      ),
    );
    return { lines, changesDecision: false, tokens: 0, by: 'template' as const };
  }
}

const NAMED = 3;

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

  switch (key) {
    case 'bottom-line': {
      const lines: WrittenLine[] = [];
      const [first, ...rest] = teamOrder;
      if (markets && first) {
        lines.push(
          grounded(
            `Open in ${first} first${rest.length ? `, then ${list(rest)}` : ''}: that is where your comps' audience is strongest among your cities.`,
            markets,
            teamOrder,
          ),
        );
      } else if (read.places.length) {
        lines.push(
          playbook(`Plan the release for ${list(read.places)} as you set it.`, read.places),
        );
      }
      const who = audience?.context.audience;
      if (age && read.ages.length) {
        lines.push(
          grounded(
            age.verdict === 'holds' || !who
              ? `Aim the campaign at ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, as planned.`
              : `Keep your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, but lead the creative with ${who}, where these comps are strongest.`,
            audience && who ? audience : age,
            [],
          ),
        );
      } else if (audience && who) {
        lines.push(grounded(`Aim the campaign at ${who}.`, audience, []));
      }
      const music = byQuery('music')[0];
      const films = byId('f-films');
      if (music && input.sections.includes('partnerships')) {
        lines.push(
          grounded(
            `Build the soundtrack and launch music around ${list(top(music, 2))}, who rank highest with this audience in ${music.context.city}.`,
            music,
            [...top(music, 2), music.context.city ?? ''].filter(Boolean),
          ),
        );
      } else if (films && input.sections.includes('placement')) {
        lines.push(grounded(`Attach the trailer to ${list(top(films, 2))}.`, films, top(films, 2)));
      }
      return lines.slice(0, 3);
    }
    case 'positioning': {
      const themes = byId('f-themes');
      const comps = input.comps.map((c) => c.name);
      const lines: WrittenLine[] = [];
      if (themes) {
        const names = themes.entities.map((e) => e.name);
        lines.push(
          grounded(
            `Lead with ${list(names.slice(0, 2).map((n) => n.toLowerCase()))}: the themes your comps share most.`,
            themes,
            [],
            'Hook',
          ),
        );
        for (const theme of names.slice(0, 3)) {
          lines.push(grounded(`A story about ${theme.toLowerCase()}.`, themes, [], 'Key messages'));
        }
      } else {
        lines.push(
          playbook(
            read.logline
              ? `Lead with what the story is about: ${read.logline}`
              : 'Lead with the story.',
            [],
            'Hook',
          ),
        );
      }
      if (comps.length) {
        lines.push(
          playbook(
            `Pitch it to buyers and press in the company of ${list(comps)}.`,
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
            `Your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')} is younger than the comps' core, so keep it for media buying and lead the creative with ${who}.`,
            audience ?? age,
            [],
            'Who they are',
          ),
        );
      }
      for (const f of [...byQuery('shows'), ...byQuery('music')]) {
        const city = f.context.city;
        lines.push(
          grounded(
            `${city ? `In ${city} they` : 'They'} also ${f.query === 'music' ? 'play' : 'watch'} ${list(top(f))}.`,
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
        const cinemas = byQuery('cinemas').find((f) => f.context.city === city);
        const tested = byId(`f-a-place-${slug(city)}`);
        if (cinemas) {
          lines.push(
            grounded(`Screen at ${list(top(cinemas, 2))}.`, cinemas, [...top(cinemas, 2)], city),
          );
        } else if (tested) {
          lines.push(
            grounded(`Plan ${city} as ${marketRole(tested.verdict)}.`, tested, [city], city),
          );
        } else {
          lines.push(playbook(`Plan ${city} as you set it.`, [city], city));
        }
      }
      const worth = byId('f-worth-a-look');
      if (worth)
        lines.push(
          grounded(
            worth.text,
            worth,
            worth.entities.map((e) => e.name).concat(teamOrder.slice(-1)),
            'Worth a look',
          ),
        );
      return lines;
    }
    case 'partnerships': {
      const lines: WrittenLine[] = [];
      for (const f of byQuery('music')) {
        lines.push(
          grounded(
            `Music: approach ${list(top(f, 2))} for the soundtrack or a launch single in ${f.context.city}.`,
            f,
            [...top(f, 2), f.context.city ?? ''].filter(Boolean),
            'Music',
          ),
        );
      }
      for (const f of byQuery('brands')) {
        lines.push(
          grounded(
            `Brands: ${list(top(f, 2))} in ${f.context.city}.`,
            f,
            [...top(f, 2), f.context.city ?? ''].filter(Boolean),
            'Brands',
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
    case 'placement': {
      const lines: WrittenLine[] = [];
      const films = byId('f-films');
      if (films)
        lines.push(
          grounded(`Attach the trailer to ${list(top(films))}.`, films, top(films), 'Films'),
        );
      for (const f of byQuery('shows')) {
        lines.push(
          grounded(
            `Run ads against ${list(top(f, 2))} in ${f.context.city}.`,
            f,
            [...top(f, 2), f.context.city ?? ''].filter(Boolean),
            'Series',
          ),
        );
      }
      return lines;
    }
    case 'publicity': {
      const lines: WrittenLine[] = [];
      const pods = byId('f-podcasts');
      if (pods)
        lines.push(
          grounded(
            `Pitch the cast and director to ${list(top(pods))}.`,
            pods,
            top(pods),
            'Podcasts',
          ),
        );
      lines.push(
        playbook(
          'Send screeners to critics and culture writers four weeks before release, watermarked.',
          [],
          'Press',
        ),
      );
      return lines;
    }
    case 'community': {
      const lines: WrittenLine[] = byQuery('community').map((f) =>
        grounded(
          `Host a community screening with ${list(top(f, 2))} in ${f.context.city}.`,
          f,
          [...top(f, 2), f.context.city ?? ''].filter(Boolean),
          f.context.city,
        ),
      );
      lines.push(
        playbook(
          'Give community partners an early screening and a share-ready trailer cut.',
          [],
          null,
        ),
      );
      return lines;
    }
    case 'route':
      return [
        playbook(
          read.route === 'streaming'
            ? 'Release on the platform in every market on one day, so press and piracy windows line up.'
            : read.route === 'festival'
              ? 'Premiere at a festival, then open in cinemas while the reviews are fresh.'
              : `Open in cinemas${teamOrder[0] ? ` in ${teamOrder[0]}` : ''} first, then roll out to the other markets over two to four weeks.`,
          read.route === 'streaming' || read.route === 'festival' ? [] : teamOrder.slice(0, 1),
        ),
        playbook(
          'Hold the streaming window until the cinema run ends, unless a platform deal sets it.',
        ),
      ];
    case 'timeline':
      return [
        playbook(
          `T-12 weeks: lock the trailer, key art and partners${read.window ? `, for ${read.window}` : ''}.`,
        ),
        playbook('T-8 weeks: trailer launch, community partners briefed.'),
        playbook('T-4 weeks: screeners out, press and podcast tour starts.'),
        playbook('T-1 week: community screenings and paid media at full weight.'),
        playbook('Opening week: event screenings, then report results to partners.'),
      ];
    case 'cadence':
      return [
        playbook(
          'Release the first two episodes together, then one a week, so the series stays in conversation.',
        ),
      ];
    case 'measure':
      return [
        playbook('Trailer views and completion rate.'),
        playbook('Pre-sales and opening weekend by city.'),
        playbook('Share of voice in each market.'),
        playbook('Community screening attendance.'),
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
              `${name} may open softer than your other cities: keep the booking small and lean on community screenings there.`,
              f,
              [name],
              null,
            ),
          ];
        });
      lines.push(
        playbook('Piracy in the first week: watermark screeners and take down leaks fast.'),
      );
      return lines;
    }
    default:
      return [];
  }
}

/** A city's role in plain words, from the verdict on it. */
export function marketRole(verdict: Finding['verdict']): string {
  switch (verdict) {
    case 'holds':
      return 'a lead market: book wide and put the cast there on opening weekend';
    case 'weak':
      return 'a solid market: book selectively and grow it with community screenings';
    case 'breaks':
      return 'a smaller market: focus on diaspora community screenings rather than a wide booking';
    default:
      return 'a community-led market: start with church, campus and diaspora screenings';
  }
}

export function sectionTitle(key: LaunchSectionKey): string {
  return SECTION_TITLES[key];
}
