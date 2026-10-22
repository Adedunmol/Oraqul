import { gamesPlan } from '@oraqul/packs';
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
import { kindOf, platformsOf } from './launch-kind.js';
import type { GamesRead } from './read.js';

const { KIND_PROFILES, PLATFORM_LABEL, rulesFor } = gamesPlan;

export type WriteInput = LaunchWriteInput<GamesRead>;
export type AnswerInput = LaunchAnswerInput<GamesRead>;
export type PlanWriter = LaunchPlanWriter<GamesRead>;

export const RULES = `How to write:
- You are a senior game launch strategist. Write the plan a publisher or an indie studio would act on this week. Decisions with reasons: each line is the move, why, and how, in one to three sentences. Be specific: names, regions, weeks, who does what.
- Answer what the person asked, using everything they gave. Their regions, platforms, launch kind, age band, comparable games, store tags and window are decisions to plan for, not hypotheses to replace. If the audience data shows one is weak, keep it, say so plainly, and say what to do about it.
- What you know about the game is only what the person wrote: the title, the genre, the platforms, the audience and the comparable games. Never describe its story, characters, mechanics or features beyond that.
- The audience data ranks the person's regions by where the game's players are densest. A region that ranks lower can still be strong for creators or community: never call a region a weak or poor market. Use the ranking for where the spend and the community work go.
- Every comparable game the person named gets its own line: what it signals to players and press, and how close a match it is. If you are not sure what a game is, say only what you are sure of.
- Use your launch knowledge freely: store page and wishlist practice, demos and festivals, creator outreach in two waves, console certification, soft launches, seasons and live events, press kits and community. These are "playbook" lines. They cite nothing and may name anything real. Call the people who play the game players, never fans, in a playbook line.
- Every claim about what the players like, follow, watch, play or buy, or where they gather, is "grounded": it cites the ids of the findings it rests on in findingIds, and names the findings' own candidates. These are measured, so prefer them to your own ideas, and weave them in as the reason for the move ("because these players follow Hades and Dead Cells"). Never present a name you know but no finding returned as something these players like.
- Fan bases (music, series, anime, films, brands, podcasts, other games) are ranked within one medium at a time. Never say a fan base in one medium is bigger or closer than one in another. Name the best in each medium and what the collab is.
- A collab the person named gets its own line. If its finding says it ranks high among its medium, say how to use it. If it ranks low, keep it and say what to add beside it. Never tell the team to drop it.
- When the brief says who the game is built for by language, culture or community ("Built for"), Qloo cannot measure that, so you cover it from your own knowledge, as playbook lines: the language of the store page, trailer and in-game text, the creators, communities and media that reach that audience, the local devices, app stores, data costs and payment habits that decide whether a launch works there, and how people in that market discover and pay for games. Name real places, platforms, carriers and payment methods you are sure of, and say nothing you are unsure of. Never claim what that audience likes or follows without a finding, never stereotype, and write about the people the way they would write about themselves.
- Qloo holds no creator or streamer data unless a finding says so. Without a creators finding, every creator line is playbook: the kinds of creator, the two waves of keys, and what to send. Never name a creator you know as someone these players follow.
- Write for a marketing team, not an analyst. Never use the words lift, index, affinity, cells, overlap, Qloo, findings, tested, confidence or data. Say it plainly: "Seoul has the strongest audience of your regions", "the players skew older than your target". No scores or decimals.
- Never describe what could not be measured. Every region, comparable game and choice the team made gets a role and a move. Where the data says little about a region, plan it around community, creator and partner moves, without saying why.
- Never invent a number. Wishlists, sales, players, installs, review scores, money, the dates of festivals, sales and showcases, and the dates of other releases may be stated only from a web fact in the list, and the line must cite its id in sourceIds. With no web facts, state none of them. Weeks before launch and percentages in a budget split are fine.
- Web facts, when listed, are for festival, showcase and sale dates, rival releases, platform rules and where this kind of game launches. Use them to make the plan's dates specific. Use only what a fact says. A line that states a web fact is a playbook line with sourceIds; it names no audience taste.
- Platform and store rules are given in the brief as launch knowledge. Use the ones that apply to the platforms named. Never advise around a date before today.
- Pick from the candidates. Leave out any that do not fit the genre or the audience, or are global mass-market giants an independent studio would not land (a soft-drink brand), and list each in "skipped" with a short reason.
- Say each thing once. A fact true for every region is one line, not one per region. Never write a line a team could not act on, such as "position the game around its heart".
- "names": every entity a grounded line recommends because of the audience, exactly as the finding writes it.
- Candidates are listed in the order Qloo ranks them for these players. Keep that order: lead with the highest-ranked candidate you keep and name the others after it. You may skip a poor fit, but never put a lower-ranked candidate ahead of a higher-ranked one you also name.
- Partner brands in the findings were chosen as brands that could realistically say yes, then ranked for the players. Pick from them in order. A brand seldom pays an independent studio in cash. The realistic ask is in kind or a co-promotion: product, credits, giveaways, hardware for creators, in return for presence and access to the players. Scale to the budget in the brief; with none given, plan for an independent release.
- Keep it readable: a person should read the whole plan in about five minutes. Each line is one or two sentences, usually under 35 words, with the move first and the reason after it. No caveats stacked inside a line. About 1,200 words in all.
- Never start a line with a label ("Hook:", "Risk:", a game's name followed by a colon). The group already names it. Write each line as a sentence a strategist would say; a risk and its fix are one sentence.
- Plain, direct words. No exclamation marks, no hype, no hedging. Never mention receipts, call ids, Qloo endpoints or scores.`;

export const PLAN_WRITER_SYSTEM = `You write a launch plan for a video game for Oraqul. You get the person's request, the brief as read, and findings measured in Qloo taste data about the audience of the game and its comparable games.

${RULES}

Sections (write only the ones listed in the request, in that order):
- bottom-line: three moves, the most important first. The first answers where to lead: the region or regions where the audience is strongest among the team's, and where the most spend and community work should go. The next two are the decisions that matter most for this launch, such as the collab with the biggest pull and the store page or beta move that comes first.
- positioning: the hook (group "Hook"), three key messages (group "Key messages"), and one line per comparable game (group "Comps"). The hook and messages come from the brief and from what the players like, never from an invented story.
- audience: who the core and secondary audience are and what else they play, follow and watch. If the audience is older or younger than the team's target, keep the target and say who to lead the creative with.
- markets: one line per team region (group = the region): its role in the launch, and the one thing to do there. Then "Worth a look" alternatives, only from the "Worth a look" finding. When the team named no region, write the lead regions from the markets finding.
- store: the store page and tags. Tie the tags to what the comparable games share, and the trailer and key art to their themes, from the findings. The capsule, the first line and the screenshots are playbook.
- events: festivals and showcases for the platforms named, with the deadlines in the platform rules. A date appears only if a web fact states it, with its sourceIds.
- softlaunch: the test markets, how long to run them, and the gates that decide whether to scale. Playbook.
- earlyaccess: the roadmap, the update cadence and how 1.0 is a second launch. Playbook.
- liveops: the seasons or live events after launch and the collab beat in each. Playbook, with grounded collab picks from the findings.
- collabs: for each medium with a finding, the best collab partners and how to approach them. The collab the team named gets its own line.
- creators: the kinds of creator, the tiers, the two waves of keys and what to send. Playbook unless a creators finding exists.
- publicity: gaming podcasts, press and the press kit, with the angle for each.
- partnerships: brand partners, each tied to the region of its finding, and what the partnership is.
- community: Discord, campuses and events, and what to run with them.
- risks: what could go wrong and what to do. A risk about taste or audience is grounded.
Launch beats, the budget split and what would sharpen the plan are written by code. Do not write them.`;

export const ANSWER_WRITER_SYSTEM = `You answer a question about a video game launch plan for Oraqul, from findings measured in Qloo taste data and your launch knowledge. Two to five lines. Answer the question first.

${RULES}

If the honest answer would change a decision in the plan (a region, a platform, the age band, a comparable game, a collab), set changesDecision to true and say what you would change. Do not change the plan yourself: the agent offers to run it as a what-if.`;

export function briefBlock(title: string, read: GamesRead, comps: CompUsed[]): string {
  const { kind, assumed } = kindOf(read);
  const named = platformsOf(read);
  const rules = rulesFor(named);
  return [
    `Launch: ${title} (${KIND_PROFILES[kind].label}${assumed ? ', assumed because the brief does not say' : ''})`,
    read.game ? `Game: ${read.game}` : '',
    read.genre ? `Genre: ${read.genre}` : '',
    `Platforms: ${named.map((p) => PLATFORM_LABEL[p]).join(', ')}${read.platforms.length ? '' : ' (assumed)'}`,
    read.country ? `Studio country: ${read.country}` : '',
    read.regions.length ? `The team's regions: ${read.regions.join(', ')}` : '',
    read.places.length
      ? `The team's regions as cities, in the order they set: ${read.places.join(', ')}`
      : '',
    read.ages.length ? `The team's age band: ${agesPhrase(read.ages)}` : '',
    read.gender ? `The team says mostly ${read.gender === 'female' ? 'women' : 'men'}` : '',
    read.window ? `Release window: ${read.window}` : 'No release date given',
    read.budget
      ? `Marketing budget: ${read.budget.currency}${Math.round(read.budget.amount).toLocaleString('en-US')}`
      : 'No marketing budget given: plan for an independent release',
    read.storeTags.length ? `Store tags the team chose: ${read.storeTags.join(', ')}` : '',
    read.franchise.length ? `Earlier games in the series: ${read.franchise.join(', ')}` : '',
    read.collabs.length ? `Collabs the team wants: ${read.collabs.join(', ')}` : '',
    read.creators.length ? `Creators already signed: ${read.creators.join(', ')}` : '',
    read.audienceNote
      ? `Built for: ${read.audienceNote}. Qloo cannot measure this, so use your own knowledge of it in playbook lines.`
      : '',
    read.partners.length ? `Partners already signed: ${read.partners.join(', ')}` : '',
    comps.length
      ? `Comparable games: ${comps.map((c) => `${c.name}${c.source === 'added' ? ' (added by Oraqul)' : ''}`).join(', ')}`
      : '',
    rules.length
      ? `Platform rules (launch knowledge):\n${rules.map((r) => `- ${r.text}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** A region's role in plain words, from the verdict on it. */
export function marketRole(verdict: Finding['verdict']): string {
  switch (verdict) {
    case 'holds':
      return 'a lead region: put the most spend and the first creator wave there';
    case 'weak':
      return 'a solid region: grow it with local creators and community events';
    case 'breaks':
      return 'a smaller region: keep the spend small and lean on creators and community';
    default:
      return 'a community-led region: start with creator and community moves';
  }
}

/** What the players do with each medium, for a sentence about what else they follow. */
const FOLLOW_VERB: Record<string, string> = {
  music: 'listen to',
  series: 'watch',
  anime: 'watch',
  film: 'watch',
  brand: 'buy from',
  podcast: 'listen to',
  game: 'play',
};

/** What to call a partnership in each medium, with the right article. */
const COLLAB_WORDS: Record<string, string> = {
  music: 'a music collab',
  series: 'a series collab',
  anime: 'an anime collab',
  film: 'a film tie-in',
  brand: 'a brand partnership',
  podcast: 'a podcast partnership',
  game: 'a crossover with another game',
};

/** A collab the team named, in plain words: use it if it ranks high, add beside it if not. */
function collabLine(collab: Finding, fans: Finding[]): WrittenLine {
  const name = collab.entities[0]?.name ?? 'the collab';
  const place = collab.numbers.place ?? 1;
  const of = collab.numbers.of ?? 1;
  const medium = fans.find((f) =>
    f.entities.some((e) => e.entityId && e.entityId === collab.entities[0]?.entityId),
  );
  const better = (medium?.entities ?? [])
    .filter((e) => e.name !== name)
    .slice(0, 2)
    .map((e) => e.name);
  const strong = of < 3 || place <= Math.ceil(of / 3);
  return strong
    ? grounded(`Take the ${name} collab forward: ${collab.text}`, collab, [name], 'Your collab')
    : grounded(
        better.length
          ? `Keep the ${name} collab, and approach ${list(better)} too: they rank higher with your players.`
          : `Keep the ${name} collab, and add a second partner in the same medium: it ranks low with your players.`,
        collab,
        [name, ...better],
        'Your collab',
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
  const profile = byId('f-profile');
  const withCity = (f: Finding, n = 2) => [...top(f, n), f.context.city ?? ''].filter(Boolean);
  const fans = byQuery('fanbase').filter((f) => !f.id.startsWith('f-fan-collab-'));
  const collabFindings = byQuery('fanbase').filter((f) => f.id.startsWith('f-fan-collab-'));
  const { kind } = kindOf(read);

  switch (key) {
    case 'bottom-line': {
      const lines: WrittenLine[] = [];
      const [first, ...rest] = teamOrder;
      if (markets && first) {
        const next = rest.slice(0, 2);
        lines.push(
          grounded(
            `Lead with ${first}${next.length ? `, then ${list(next)}` : ''}: that is where your game's players are strongest${rest.length > 2 ? ' of the regions checked' : ''}.`,
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
              ? `Aim the campaign at ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, as planned.`
              : `Keep your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, but lead the creative with ${who}, where this game is strongest.`,
            audience && who ? audience : age,
            [],
          ),
        );
      } else if (audience && who) {
        lines.push(grounded(`Aim the campaign at ${who}.`, audience, []));
      }
      const pick = collabFindings[0] ?? fans[0];
      if (pick && input.sections.includes('collabs')) {
        lines.push(
          collabFindings[0]
            ? collabLine(collabFindings[0], fans)
            : grounded(
                `Start collab talks with ${list(top(pick, 2))}, who rank highest with your players.`,
                pick,
                top(pick, 2),
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
                `Make the store page, the trailer and the in-game text feel made for ${read.audienceNote}, in their language where the game allows it.`,
                [],
                'Audience',
              ),
            ]
          : []),
        playbook(
          read.genre
            ? `Name the genre, ${read.genre}, in the first line of the store page and show the core loop in the first seconds of the trailer.`
            : 'Name the genre in the first line of the store page and show the core loop in the first seconds of the trailer.',
          [],
          'Hook',
        ),
      ];
      if (comps.length) {
        lines.push(
          playbook(
            `Pitch the game to press, creators and players in the company of ${list(comps)}.`,
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
            `Your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')} differs from the game's core, so keep it for media buying and lead the creative with ${who}.`,
            audience ?? age,
            [],
            'Who they are',
          ),
        );
      }
      for (const f of fans.slice(0, 4)) {
        const verb = FOLLOW_VERB[f.id.replace('f-fan-', '')] ?? 'follow';
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
    case 'store': {
      const lines: WrittenLine[] = [];
      const tagNames = profile?.entities.filter((e) => e.detail === 'tag').map((e) => e.name) ?? [];
      if (profile && tagNames.length) {
        lines.push(
          grounded(
            `Tag the store page with what your comparable games are tagged with: ${list(tagNames.slice(0, 5))}.`,
            profile,
            tagNames.slice(0, 5),
            'Tags',
          ),
        );
      }
      const themes = byId('f-tags-theme');
      if (themes) {
        lines.push(
          grounded(
            `Build the trailer and key art around the themes your comparable games share: ${list(top(themes, 4))}.`,
            themes,
            top(themes, 4),
            'Trailer and art',
          ),
        );
      }
      lines.push(
        playbook(
          'Make the capsule and the first seconds of the trailer readable at small sizes, with gameplay shown early.',
          [],
          'Store page',
        ),
      );
      return lines;
    }
    case 'events':
      return [
        playbook(
          'Join one festival with a polished demo, once: registration closes weeks ahead, and pre-festival wishlists decide how much it adds.',
          [],
          'Festivals',
        ),
        playbook(
          'Time a trailer drop or an announcement for a showcase in the weeks before the date, and book the slot early.',
          [],
          'Showcases',
        ),
      ];
    case 'softlaunch':
      return [
        playbook(
          'Soft launch in two or three test markets for at least 30 days, and 60 to read day 30 retention across cohorts.',
          [],
          'Test markets',
        ),
        playbook(
          'Set the gates before the test starts: day 1, 7 and 30 retention and cost per install, and scale only when they hold.',
          [],
          'Gates',
        ),
      ];
    case 'earlyaccess':
      return [
        playbook(
          'Publish the roadmap with the planned 1.0 date before launch, and promise only what the team can ship.',
          [],
          'Roadmap',
        ),
        playbook(
          'Ship an update every four to six weeks and post the progress with each one.',
          [],
          'Updates',
        ),
        playbook(
          'Plan 1.0 as a second launch: a new trailer, a date, press keys two weeks out and a content drop that headlines it.',
          [],
          '1.0',
        ),
      ];
    case 'liveops': {
      const lines: WrittenLine[] = [
        playbook(
          'Plan each season on an eight to twelve week cadence, with a collab or event beat in every one.',
          [],
          'Seasons',
        ),
      ];
      const pick = fans[0];
      if (pick) {
        lines.push(
          grounded(
            `Use season one's collab beat for ${list(top(pick, 2))}, who rank highest with your players.`,
            pick,
            top(pick, 2),
            'Collabs',
          ),
        );
      }
      return lines;
    }
    case 'collabs': {
      const lines: WrittenLine[] = collabFindings.map((f) => collabLine(f, fans));
      for (const f of fans) {
        const medium = f.id.replace('f-fan-', '');
        lines.push(
          grounded(
            `For ${COLLAB_WORDS[medium] ?? 'a collab'}, approach ${list(top(f, 2))}: they rank highest with your players.`,
            f,
            top(f, 2),
            medium.charAt(0).toUpperCase() + medium.slice(1),
          ),
        );
      }
      return lines;
    }
    case 'creators': {
      const lines: WrittenLine[] = [];
      const creators = byId('f-creators');
      if (creators) {
        lines.push(
          grounded(
            `Start creator outreach with ${list(top(creators, 3))}, who rank highest with your players.`,
            creators,
            top(creators, 3),
            'Who',
          ),
        );
      }
      if (read.creators.length) {
        lines.push(
          playbook(
            `Brief ${list(read.creators)} first: they are already signed.`,
            read.creators,
            'Already signed',
          ),
        );
      }
      lines.push(
        playbook(
          'Build a tiered list of creators who cover your genre: a few large, more mid-sized and many small ones.',
          [],
          'Tiers',
        ),
        playbook(
          'Send preview keys and the press kit to the first wave six to four weeks before launch, and launch keys to a second wave in the final two weeks.',
          [],
          'Two waves',
        ),
      );
      return lines;
    }
    case 'publicity': {
      const lines: WrittenLine[] = [];
      const pods = byId('f-podcasts');
      if (pods) {
        lines.push(grounded(`Pitch the game to ${list(top(pods))}.`, pods, top(pods), 'Podcasts'));
      }
      lines.push(
        playbook(
          'Send a press kit, a short build and a one-page summary to press six weeks before launch, and hold the review embargo until launch day.',
          [],
          'Press',
        ),
      );
      return lines;
    }
    case 'partnerships': {
      const lines: WrittenLine[] = [];
      for (const f of byQuery('brands')) {
        lines.push(
          grounded(
            `Brands: ${list(top(f, 2))}${f.context.city ? ` in ${f.context.city}` : ''}.`,
            f,
            withCity(f),
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
    case 'community': {
      const lines: WrittenLine[] = byQuery('community').map((f) =>
        grounded(
          `Run a campus tournament or a meet-up with ${list(top(f, 2))} in ${f.context.city}.`,
          f,
          withCity(f),
          f.context.city,
        ),
      );
      lines.push(
        playbook(
          'Open a Discord before the store page goes live, and give its first members early access to the demo.',
          [],
          'Discord',
        ),
      );
      return lines;
    }
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
                `${name} may convert softer than your other regions: keep the spend small and lean on creators and community there.`,
                f,
                [name],
                null,
              ),
            ];
          }
          if (f.id === 'f-a-platform') {
            return [
              grounded(
                'Some players of your comparable games are on a platform you are not shipping to: say so on the store page, and watch where the wishlists come from.',
                f,
                [],
              ),
            ];
          }
          if (f.id === 'f-a-store-tags') {
            return [
              grounded(
                'Your store tags differ from what your comparable games carry, so the store may not show the game to their players: add the shared tags.',
                f,
                [],
              ),
            ];
          }
          return [];
        });
      lines.push(
        playbook(
          'A slipped release date: hold the date once it is public, and keep the first beats to the platforms you can fully support.',
        ),
      );
      return lines;
    }
    default:
      return [];
  }
}

export function sectionTitle(key: LaunchSectionKey): string {
  return gamesPlan.SECTION_TITLES[key];
}

export const gamesWriterKit: WriterKit<GamesRead> = {
  planSystem: PLAN_WRITER_SYSTEM,
  answerSystem: ANSWER_WRITER_SYSTEM,
  brief: briefBlock,
  templateSection,
};

export class ModelPlanWriter extends LaunchModelWriter<GamesRead> {
  constructor(model: LanguageModel, timeoutMs: number, options: ProviderOptions = {}) {
    super(model, timeoutMs, gamesWriterKit, options);
  }
}

/** Falls back to the template writer when the model fails, so a plan never stops at writing. */
export class FallbackPlanWriter extends LaunchFallbackWriter<GamesRead> {}

export class TemplatePlanWriter extends LaunchTemplateWriter<GamesRead> {
  constructor() {
    super(gamesWriterKit);
  }
}
