import { booksPlan } from '@oraqul/packs';
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
import { hasAudio, kindOf, readershipOf, routeOf } from './launch-kind.js';
import type { BooksRead } from './read.js';

const { KIND_PROFILES } = booksPlan;

export type WriteInput = LaunchWriteInput<BooksRead>;
export type AnswerInput = LaunchAnswerInput<BooksRead>;
export type PlanWriter = LaunchPlanWriter<BooksRead>;

export const RULES = `How to write:
- You are a senior book publicist and launch strategist. Write the plan a publisher's marketing team or an independent author would act on this week. Decisions with reasons: each line is the move, why, and how, in one to three sentences. Be specific: names, markets, weeks, who does what.
- Answer what the person asked, using everything they gave. Their markets, launch kind, route, readership, formats, age band, comparable books, screen comparisons, bookshops and window are decisions to plan for, not hypotheses to replace. If the audience data shows one is weak, keep it, say so plainly, and say what to do about it.
- What you know about the book is only what the person wrote: the title, the author, the genre, the readership, the formats and the audience. Never describe its plot, characters or reviews beyond that, and never invent an award, a quote or a sales figure.
- The audience data ranks the person's markets by where the book's readers are densest. A market that ranks lower can still be strong for events and book clubs: never call a market weak or poor. Use the ranking for where the spend and the events go.
- Every comparable book the person named gets its own line: what it signals to booksellers, reviewers and readers, and how close a match it is. If you are not sure what a book is, say only what you are sure of.
- Use your publishing knowledge freely: advance copies and proofs, retail sell-in and pre-orders, long-lead press, reviews and Goodreads, bookshop events and signings, festivals, book clubs, newsletters and newsletter swaps, BookTok and other creators, price promotions, audiobooks, school and library lists. These are "playbook" lines. They cite nothing and may name anything real. Call the people who read the book readers, never fans, in a playbook line.
- Every claim about what the readers like, read, watch, hear or buy, or where they go, is "grounded": it cites the ids of the findings it rests on in findingIds, and names the findings' own candidates. These are measured, so prefer them to your own ideas, and weave them in as the reason for the move ("because these readers pick up Stay with Me and Freshwater"). Never present a name you know but no finding returned as something these readers like.
- The shelf is the recent books these readers pick up: they are the comps to pitch against. A comp the team named that is older is kept as a reference, with a recent book from the shelf beside it. Never tell the team to drop a comp.
- The screen angle is a comparison for the pitch, never a claim that an adaptation exists or is coming. Name the series and films the findings rank highest, in order, and the podcasts the readers hear. A screen title the person named gets its own line: if it ranks high, say how to use it; if it ranks low, keep it and say which to add beside it.
- When the brief says who the book is for by language, culture or community ("Made for"), Qloo cannot measure that, so you cover it from your own knowledge, as playbook lines: the language of the pitch, the newsletters, communities, festivals and media that reach that audience, the shops and platforms people there buy from, and how readers there find books. Name real places you are sure of, and say nothing you are unsure of. Never claim what that audience likes or follows without a finding, never stereotype, and write about the people the way they would write about themselves.
- Qloo holds no data on creators, BookTok or authors to approach unless a finding says so. Without one, every creators line is playbook: the kinds of creator, how to ask and what to send.
- A book for children is bought by adults. Write the retail, school and library lines for the parents, teachers and librarians, and never claim what a child likes.
- Write for a marketing team, not an analyst. Never use the words lift, index, affinity, cells, overlap, Qloo, findings, tested, confidence or data. Say it plainly: "Lagos has the strongest readership of your markets", "the readers skew older than your target". No scores or decimals.
- Never write about limits or about what could not be measured; write about what to do. When something is missing, give the closest thing the findings do show, call it close, and say in a few words what the team could tell you to sharpen it. Every market, comparable book and choice the team made gets a role and a move. Where the data says little about a market, plan it around events and book clubs, and say in a few words what you used and what the team could tell you to sharpen it.
- A comp marked (added by Oraqul) was chosen by Oraqul from the description, so the audience findings describe the people who like those books, not the person's own work: write "people who like books like yours", never "your audience" or "your readers". A detail under "Assumed, not said by the person" was filled in by Oraqul: never say the brief or the team gave it; say "assuming" or leave it out.
- Never invent a number. Sales, copies, pre-orders, chart positions, advances, review counts, prize dates, festival dates and the dates of other releases may be stated only from a web fact in the list, and the line must cite its id in sourceIds. With no web facts, state none of them. Weeks before publication and percentages in a budget split are fine.
- Web facts, when listed, are for festival and prize dates, rival releases, retailer and pre-order norms and how readers in the named markets buy books. Use them to make the plan's dates specific. Use only what a fact says. A line that states a web fact is a playbook line with sourceIds; it names no audience taste.
- Pick from the candidates. Leave out any that do not fit the genre or the readers, or are global mass-market giants a new book would not land (a soft-drink brand), and list each in "skipped" with a short reason.
- Say each thing once. A fact true for every market is one line, not one per market. Never write a line a team could not act on, such as "position the book around its heart".
- "names": every entity a grounded line recommends because of the audience, exactly as the finding writes it.
- Candidates are listed in the order Qloo ranks them for these readers. Keep that order: lead with the highest-ranked candidate you keep and name the others after it. You may skip a poor fit, but never put a lower-ranked candidate ahead of a higher-ranked one you also name.
- Brand partners in the findings were chosen as brands that could realistically say yes, then ranked for the readers. Pick from them in order. A brand seldom pays for a book launch in cash. The realistic ask is in kind or a co-promotion: product, a venue, giveaways, ad space, in return for presence and access to the readers. Scale to the budget in the brief; with none given, plan for a small launch.
- Keep it readable: a person should read the whole plan in about five minutes. Each line is one or two sentences, usually under 35 words, with the move first and the reason after it. No caveats stacked inside a line. About 1,200 words in all.
- Never start a line with a label ("Hook:", "Risk:", a title followed by a colon). The group already names it. Write each line as a sentence a strategist would say; a risk and its fix are one sentence.
- Plain, direct words. No exclamation marks, no hype, no hedging. Never mention receipts, call ids, Qloo endpoints or scores.`;

export const PLAN_WRITER_SYSTEM = `You write a launch plan for a book for Oraqul. You get the person's request, the brief as read, and findings measured in Qloo taste data about the readers of the book and its comparable books.

${RULES}

Sections (write only the ones listed in the request, in that order):
- bottom-line: three moves, the most important first. The first answers where to lead: the market or markets where the readers are strongest among the team's, and where the most spend and events should go. The next two are the decisions that matter most for this launch, such as the recent books to pitch against and the screen angle with the most pull.
- positioning: the hook (group "Hook"), three key messages (group "Key messages"), and one line per comparable book (group "Comps"). The hook and messages come from the brief, the themes the findings give and what the readers like, never from an invented plot.
- audience: who the core and secondary readers are and what else they read, watch and hear. If the readers are older or younger than the team's target, keep the target and say who to lead the creative with.
- markets: one line per team market (group = the market): its role in the launch, and the one thing to do there. Then "Worth a look" alternatives, only from the "Worth a look" finding. When the team named no market, write the lead markets from the markets finding.
- comps: the recent books to pitch against, in the order of the findings, and how to use them with booksellers, reviewers and readers. A comp the team named gets its own line.
- adaptation: the screen and audio angles: the series and films the readers also watch, and the podcasts they hear, in the order of the findings, and how to use them in the pitch. A screen title the team named gets its own line.
- retail: pre-orders, the sell-in to the shops and the promotion asks, for a book a publisher sells. Playbook, with the bookshops from the findings where they fit.
- publicity: reviews, long-lead press, newsletters and the podcasts to pitch the author to, from the findings.
- events: launch events, signings and festivals, using the bookshops from the findings in the best markets.
- creators: the kinds of creator and reviewer for the genre, how to ask and what to send. Playbook.
- partnerships: brand partners, each tied to the city of its finding, and what the partnership is.
- community: book clubs and reader groups: where readers gather and what to run there.
- audio: the audiobook release and its sample. Playbook.
- schools: school and library lists, discussion guides and the people who buy for young readers. Playbook.
- cadence: the series or backlist plan for the kind of launch: how the earlier books are used and when the next one is announced. Playbook.
- creative: two to four hook options for the lead territory, and one key art brief (what the image must show, the tone, what to avoid). Guides only: Oraqul writes the brief and a person makes the trailer, ad or image. Never offer to generate one. Channels, what to measure and the timeline are written by code, so write none of them, and state no targets.
- risks: what could go wrong and what to do. A risk about taste, comps or readers is grounded.
Launch beats, the budget split and what would sharpen the plan are written by code. Do not write them.`;

export const ANSWER_WRITER_SYSTEM = `You answer a question about a book launch plan for Oraqul, from findings measured in Qloo taste data and your publishing knowledge. Two to five lines. Answer the question first.

${RULES}

If the honest answer would change a decision in the plan (a market, the age band, a comparable book, a screen comparison, a bookshop), set changesDecision to true and say what you would change. Do not change the plan yourself: the agent offers to run it as a what-if.`;

export function briefBlock(title: string, read: BooksRead, comps: CompUsed[]): string {
  const { kind, assumed } = kindOf(read);
  const route = routeOf(read);
  const readership = readershipOf(read);
  return [
    `Launch: ${title} (${KIND_PROFILES[kind].label}${assumed ? ', assumed because the brief does not say' : ''})`,
    read.book ? `Book: ${read.book}` : '',
    read.author ? `Author: ${read.author}` : '',
    read.genre ? `Genre: ${read.genre}` : '',
    `Route: ${route.route === 'indie' ? 'self-published' : 'sold to shops by a publisher'}${route.assumed ? ' (assumed)' : ''}`,
    `Readers: ${readership.readership === 'ya' ? 'young adult' : readership.readership === 'children' ? 'children, bought by adults' : 'adult'}${readership.assumed ? ' (assumed)' : ''}`,
    read.formats.length
      ? `Formats: ${read.formats.join(', ')}${hasAudio(read) ? '' : ' (no audiobook named)'}`
      : 'Formats: none named',
    read.country ? `Country: ${read.country}` : '',
    read.regions.length ? `The team's markets: ${read.regions.join(', ')}` : '',
    read.places.length
      ? `The team's markets as cities, in the order they set: ${read.places.join(', ')}`
      : '',
    read.ages.length ? `The team's age band: ${agesPhrase(read.ages)}` : '',
    read.gender ? `The team says mostly ${read.gender === 'female' ? 'women' : 'men'}` : '',
    read.window ? `Publication window: ${read.window}` : 'No publication date given',
    read.budget
      ? `Marketing budget: ${read.budget.currency}${Math.round(read.budget.amount).toLocaleString('en-US')}`
      : 'No marketing budget given: plan for a small launch',
    read.previousBooks.length ? `Earlier books: ${read.previousBooks.join(', ')}` : '',
    read.screenTitles.length
      ? `Screen titles the team compares it with: ${read.screenTitles.join(', ')}`
      : '',
    read.bookshops.length
      ? `Bookshops and venues the team named: ${read.bookshops.join(', ')}`
      : '',
    read.audienceNote
      ? `Made for: ${read.audienceNote}. Qloo cannot measure this, so use your own knowledge of it in playbook lines.`
      : '',
    read.partners.length ? `Partners already signed: ${read.partners.join(', ')}` : '',
    comps.length
      ? `Comparable books: ${comps.map((c) => `${c.name}${c.source !== 'you' ? ' (added by Oraqul)' : ''}`).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** A market's role in plain words, from the verdict on it. */
export function marketRole(verdict: Finding['verdict']): string {
  switch (verdict) {
    case 'holds':
      return 'a lead market: put the most spend and the launch event there';
    case 'weak':
      return 'a solid market: grow it with bookshop events and book clubs';
    case 'breaks':
      return 'a smaller market: keep the spend small and lean on events and book clubs';
    default:
      return 'a community-led market: start with bookshops and book clubs';
  }
}

/** A screen comparison the team named, in plain words: use it if it ranks high, add beside it if not. */
function screenLine(screen: Finding, bridge: Finding | undefined): WrittenLine {
  const name = screen.entities[0]?.name ?? 'the title';
  const place = screen.numbers.place ?? 1;
  const of = screen.numbers.of ?? 1;
  const better = (bridge?.entities ?? [])
    .filter((e) => e.name !== name)
    .slice(0, 2)
    .map((e) => e.name);
  const strong = of < 3 || place <= Math.ceil(of / 3);
  return strong
    ? grounded(
        `Keep ${name} as the screen comparison in the pitch: ${screen.text}`,
        screen,
        [name],
        'Your pick',
      )
    : grounded(
        better.length
          ? `Keep ${name} as a comparison, and add ${list(better)} to the pitch too: they rank higher with your readers.`
          : `Keep ${name} as a comparison, and add a second title from the same kind of story: it ranks low with your readers.`,
        screen,
        [name, ...better],
        'Your pick',
      );
}

/** The comps the team named that Qloo dates as a few years back or older, with the findings that say so. */
function olderComps(
  read: BooksRead,
  findings: Finding[],
): { names: string[]; findingIds: string[] } {
  const older = read.comps.flatMap((name) => {
    const f = findings.find((x) => x.id === `f-a-comp-age-${slug(name)}`);
    return f && (f.verdict === 'weak' || f.verdict === 'breaks') ? [{ name, id: f.id }] : [];
  });
  return { names: older.map((o) => o.name), findingIds: older.map((o) => o.id) };
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
  const shelf = byId('f-shelf');
  const themes = byId('f-themes-theme');
  const podcasts = byId('f-podcasts');
  const series = byId('f-bridge-series');
  const films = byId('f-bridge-film');
  const screens = byQuery('bridge').filter((f) => f.id.startsWith('f-screen-'));
  const shops = byQuery('bookshops');
  const withCity = (f: Finding, n = 2) => [...top(f, n), f.context.city ?? ''].filter(Boolean);
  const { kind } = kindOf(read);

  switch (key) {
    case 'bottom-line': {
      const lines: WrittenLine[] = [];
      const [first, ...rest] = teamOrder;
      if (markets && first) {
        const next = rest.slice(0, 2);
        lines.push(
          grounded(
            `Lead with ${first}${next.length ? `, then ${list(next)}` : ''}: that is where your book's readers are strongest${rest.length > 2 ? ' of the markets checked' : ''}.`,
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
              : `Keep your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')}, but lead the creative with ${who}, where this book is strongest.`,
            audience && who ? audience : age,
            [],
          ),
        );
      } else if (audience && who) {
        lines.push(grounded(`Aim the launch at ${who}.`, audience, []));
      }
      if (shelf) {
        lines.push(
          grounded(
            `Pitch the book against ${list(top(shelf, 2))}, recent books your readers pick up.`,
            shelf,
            top(shelf, 2),
          ),
        );
      } else if (series) {
        lines.push(
          grounded(
            `Lead the screen angle with ${list(top(series, 2))}, which rank highest with your readers.`,
            series,
            top(series, 2),
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
                `Make the pitch, the cover copy and the events feel made for ${read.audienceNote}, in their language where the book allows it.`,
                [],
                'Audience',
              ),
            ]
          : []),
        playbook(
          read.genre
            ? `Name the genre, ${read.genre}, and the closest comparable book in the first line of the blurb and of the pitch to booksellers.`
            : 'Name the genre and the closest comparable book in the first line of the blurb and of the pitch to booksellers.',
          [],
          'Hook',
        ),
      ];
      if (themes) {
        lines.push(
          grounded(
            `Lead the key messages with ${list(themes.entities.slice(0, 3).map((t) => t.name.toLowerCase()))}, the themes your comparable books share.`,
            themes,
            [],
            'Key messages',
          ),
        );
      }
      if (comps.length) {
        lines.push(
          playbook(
            `Pitch the book to booksellers, press and readers in the company of ${list(comps)}.`,
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
        lines.push(grounded(`The core readers are ${who}.`, audience, [], 'Who they are'));
      }
      if (age && who && age.verdict !== 'holds' && read.ages.length) {
        lines.push(
          grounded(
            `Your target of ${agesPhrase(read.ages).replace('aged ', 'people aged ')} differs from the book's core readers, so keep it for media buying and lead the creative with ${who}.`,
            audience ?? age,
            [],
            'Who they are',
          ),
        );
      }
      if (shelf) {
        lines.push(
          grounded(
            `They also read ${list(top(shelf, 2))}.`,
            shelf,
            top(shelf, 2),
            'What else they follow',
          ),
        );
      }
      if (series) {
        lines.push(
          grounded(
            `They also watch ${list(top(series, 2))}.`,
            series,
            top(series, 2),
            'What else they follow',
          ),
        );
      }
      if (podcasts) {
        lines.push(
          grounded(
            `They also hear ${list(top(podcasts, 2))}.`,
            podcasts,
            top(podcasts, 2),
            'What else they follow',
          ),
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
    case 'comps': {
      const lines: WrittenLine[] = [];
      // The older comps the team named are one line, kept as references with recent books beside them.
      const older = olderComps(read, byQuery('shelf'));
      if (older.names.length) {
        lines.push({
          kind: 'grounded',
          text: shelf
            ? `Keep ${list(older.names)} as ${older.names.length > 1 ? 'references' : 'a reference'}, and pitch against ${list(top(shelf, 2))} too: they are recent books your readers pick up.`
            : `Keep ${list(older.names)} as ${older.names.length > 1 ? 'references' : 'a reference'}, and add a book from the last five years beside ${older.names.length > 1 ? 'them' : 'it'}.`,
          findingIds: [...older.findingIds, ...(shelf ? [shelf.id] : [])],
          sourceIds: [],
          names: [...older.names, ...(shelf ? top(shelf, 2) : [])],
          group: 'Your comps',
        });
      }
      if (shelf) {
        lines.push(
          grounded(
            `Pitch the book against ${list(top(shelf, 3))}: the recent books your readers pick up, in that order.`,
            shelf,
            top(shelf, 3),
            'Shelf',
          ),
        );
      }
      lines.push(
        playbook(
          'Put the two closest comparable books in the first line of the pitch to booksellers and in the note to reviewers.',
          [],
          'How',
        ),
      );
      return lines;
    }
    case 'adaptation': {
      const lines: WrittenLine[] = screens.map((f) =>
        screenLine(f, f.entities[0]?.detail === 'Film' ? films : series),
      );
      if (series) {
        lines.push(
          grounded(
            `For a screen angle, set the book beside ${list(top(series, 2))}, the series that rank highest with your readers.`,
            series,
            top(series, 2),
            'Series',
          ),
        );
      }
      if (films) {
        lines.push(
          grounded(
            `For film, set the book beside ${list(top(films, 2))}, the films that rank highest with your readers.`,
            films,
            top(films, 2),
            'Film',
          ),
        );
      }
      if (podcasts) {
        lines.push(
          grounded(
            `For audio, offer the author to ${list(top(podcasts, 2))}, the podcasts your readers hear.`,
            podcasts,
            top(podcasts, 2),
            'Audio',
          ),
        );
      }
      lines.push(
        playbook(
          'Use these as comparisons in the pitch only. Do not announce an adaptation until a producer is attached.',
          [],
          'How',
        ),
      );
      return lines;
    }
    case 'retail':
      return [
        playbook(
          'Open pre-orders on every retail page eight weeks out, and ask the buyers for a display or a promotion slot against the closest comparable book.',
          [],
          'Pre-orders',
        ),
        ...shops
          .slice(0, 2)
          .map((f) =>
            grounded(
              `Ask ${list(top(f, 2))}${f.context.city ? ` in ${f.context.city}` : ''} to stock and display the book: they rank highest with your readers.`,
              f,
              withCity(f),
              'Bookshops',
            ),
          ),
      ];
    case 'publicity': {
      const lines: WrittenLine[] = [];
      if (podcasts) {
        lines.push(
          grounded(
            `Pitch the author as a guest to ${list(top(podcasts, 3))}, the podcasts about books that your readers hear.`,
            podcasts,
            top(podcasts, 3),
            'Podcasts',
          ),
        );
      }
      lines.push(
        playbook(
          'Send long-lead outlets finished copies three months out, and the newsletters and review sites for the genre an advance copy and a short note on why now.',
          [],
          'Press',
        ),
      );
      return lines;
    }
    case 'events': {
      const lines: WrittenLine[] = shops.map((f) =>
        grounded(
          `Plan the launch event or a signing at ${list(top(f, 2))}${f.context.city ? ` in ${f.context.city}` : ''}: they rank highest with your readers.`,
          f,
          withCity(f),
          f.context.city ?? 'Events',
        ),
      );
      for (const name of read.bookshops) {
        lines.push(
          playbook(
            `Confirm the event at ${name} in writing, with the date and the stock.`,
            [name],
            'Already named',
          ),
        );
      }
      if (lines.length === 0) {
        lines.push(
          playbook(
            'Book one launch event in the lead market, and a signing at an independent bookshop there.',
            [],
            'Events',
          ),
        );
      }
      return lines;
    }
    case 'creators':
      return [
        playbook(
          'Send finished copies to the reviewers and creators who cover the genre two weeks before launch, with a short note and a date to post.',
          [],
          'Creators',
        ),
      ];
    case 'partnerships': {
      const lines: WrittenLine[] = [];
      for (const f of byQuery('brands')) {
        lines.push(
          grounded(
            `Approach ${list(top(f, 2))}${f.context.city ? ` in ${f.context.city}` : ''} for an in-kind partnership or a co-promotion: they rank highest with your readers.`,
            f,
            withCity(f),
            'Brand partners',
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
    case 'community':
      return [
        playbook(
          'Give book clubs a reading kit and the first chapter before launch, and offer the author for one club evening in each lead market.',
          [],
          'Book clubs',
        ),
      ];
    case 'audio':
      return [
        playbook(
          'Release the audiobook the same day as the book, with a three-minute sample on every retail page and on the author’s channels.',
          [],
          'Audiobook',
        ),
      ];
    case 'schools':
      return [
        playbook(
          'Send teachers and librarians a free copy and a discussion guide before launch, and ask for the book to be added to a reading list.',
          [],
          'Schools and libraries',
        ),
      ];
    case 'cadence':
      return [
        playbook(
          kind === 'series'
            ? 'Tell the readers of the earlier books first, and put a price promotion on book one for the launch fortnight so new readers can start the series.'
            : kind === 'backlist'
              ? 'Relaunch with the new cover and edition on every retail page, and promote the edition in the weeks around any screen release.'
              : 'Tell the readers of the earlier books first, then bring in new readers with the comparable books in the pitch.',
          [],
          kind === 'backlist' ? 'Backlist' : 'Series',
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
                `${name} may grow slower than your other markets: keep the spend small and lean on events and book clubs there.`,
                f,
                [name],
                null,
              ),
            ];
          }
          return [];
        });
      const old = olderComps(read, findings);
      if (old.names.length) {
        lines.push({
          kind: 'grounded',
          text: `${capitalise(list(old.names))} ${old.names.length > 1 ? 'are older books' : 'is an older book'}, so pitch against a recent book beside ${old.names.length > 1 ? 'them' : 'it'}, or booksellers will read the comparison as dated.`,
          findingIds: old.findingIds,
          sourceIds: [],
          names: old.names,
          group: null,
        });
      }
      lines.push(
        playbook(
          'A slipped publication date: hold the date once pre-orders open, and tell booksellers and reviewers the same day if it moves.',
        ),
      );
      return lines;
    }
    default:
      return [];
  }
}

export function sectionTitle(key: LaunchSectionKey): string {
  return booksPlan.SECTION_TITLES[key];
}

export const booksWriterKit: WriterKit<BooksRead> = {
  planSystem: PLAN_WRITER_SYSTEM,
  answerSystem: ANSWER_WRITER_SYSTEM,
  brief: briefBlock,
  templateSection,
};

export class ModelPlanWriter extends LaunchModelWriter<BooksRead> {
  constructor(model: LanguageModel, timeoutMs: number, options: ProviderOptions = {}) {
    super(model, timeoutMs, booksWriterKit, options);
  }
}

/** Falls back to the template writer when the model fails, so a plan never stops at writing. */
export class FallbackPlanWriter extends LaunchFallbackWriter<BooksRead> {}

export class TemplatePlanWriter extends LaunchTemplateWriter<BooksRead> {
  constructor() {
    super(booksWriterKit);
  }
}
