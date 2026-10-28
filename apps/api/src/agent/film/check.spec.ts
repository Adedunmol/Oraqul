import type { Finding } from '@oraqul/schema';
import { type CheckContext, checkLine, checkSections } from './check.js';

const finding = (over: Partial<Finding>): Finding => ({
  id: 'f-music-lagos',
  query: 'music',
  text: 'In Lagos, the Afrobeats artists that rank highest with your comps’ audience are Burna Boy, Tems and Rema.',
  entities: ['Burna Boy', 'Tems', 'Rema'].map((name) => ({
    entityId: null,
    name,
    affinity: 0.9,
    detail: null,
  })),
  numbers: {},
  verdict: null,
  confidence: 'high',
  why: '',
  context: {
    city: 'Lagos',
    ages: [],
    tags: ['Afrobeats'],
    country: null,
    yearFrom: null,
    audience: null,
  },
  callIds: ['00000000-0000-4000-8000-000000000001'],
  ...over,
});

const markets = finding({
  id: 'f-markets',
  query: 'markets',
  text: 'Among your cities, your comps’ audience is strongest in Lagos (lift 1.42), then London (1.1).',
  entities: ['Lagos', 'London'].map((name) => ({
    entityId: null,
    name,
    affinity: null,
    detail: null,
  })),
  numbers: { 'lift Lagos': 1.42, 'lift London': 1.1 },
  context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
});

const ctx: CheckContext = {
  findings: [finding({}), markets],
  sources: [],
  briefNames: ['Third Bridge', 'King of Boys', 'Lagos', 'London'],
  briefText: 'A crime thriller for 18 to 34, opening in Lagos and London.',
  teamCities: ['Lagos', 'London'],
  teamAges: ['24_and_younger', '25_to_29', '30_to_34'],
  allowed: ['bottom-line', 'partnerships', 'route', 'markets', 'gaps'],
};

const line = (over: Partial<Parameters<typeof checkLine>[1]>) => ({
  kind: 'grounded' as const,
  text: 'Approach Tems for the launch single.',
  findingIds: ['f-music-lagos'],
  sourceIds: [],
  names: ['Tems'],
  group: null,
  ...over,
});

describe('checkLine and links', () => {
  const playbook = (text: string, over: Partial<Parameters<typeof checkLine>[1]> = {}) =>
    line({ kind: 'playbook', findingIds: [], names: [], text, ...over });

  it('drops a link, an email or a phone number the writer put in', () => {
    for (const text of [
      'Book the premiere through https://tickets.example/offer today.',
      'Send the screener to press@evil.example before the premiere.',
      'Call +234 801 234 5678 to confirm the venue.',
      'Pitch the story at www.evil.example with a clip.',
    ]) {
      expect(checkLine('route', playbook(text), ctx), text).toMatch(/link or contact detail/);
    }
  });

  it('keeps a contact the person wrote in the brief', () => {
    const withContact = {
      ...ctx,
      briefText: 'Press enquiries go to press@studio.example for this thriller.',
    };
    expect(
      checkLine('route', playbook('Send the screener to press@studio.example first.'), withContact),
    ).toBeNull();
  });

  it('keeps a link a cited page states', () => {
    const cited = {
      ...ctx,
      sources: [
        {
          id: 'w1',
          url: 'https://news.example/a',
          title: 'A',
          fact: 'Submissions open at www.festival.example until June.',
        },
      ],
    } as unknown as CheckContext;
    expect(
      checkLine(
        'route',
        playbook('Submit at www.festival.example before the deadline.', { sourceIds: ['w1'] }),
        cited,
      ),
    ).toBeNull();
  });

  it('does not take ordinary numbers for phone numbers', () => {
    expect(
      checkLine('route', playbook('Run the trailer in weeks 2 and 6 of the 90 day window.'), ctx),
    ).toBeNull();
  });
});

describe('checkLine', () => {
  it('keeps a grounded line that names what its finding returned', () => {
    expect(checkLine('partnerships', line({}), ctx)).toBeNull();
  });

  it('drops a grounded line with no finding, or one that does not exist', () => {
    expect(checkLine('partnerships', line({ findingIds: [], sourceIds: [] }), ctx)).toMatch(
      /cites no finding/,
    );
    expect(
      checkLine('partnerships', line({ findingIds: ['f-made-up'], sourceIds: [] }), ctx),
    ).toMatch(/not a finding/);
  });

  it('drops a name the cited findings do not have, declared or written', () => {
    expect(
      checkLine('partnerships', line({ text: 'Approach Wizkid.', names: ['Wizkid'] }), ctx),
    ).toMatch(/Wizkid/);
    // Named in another finding, but not in the one it cites.
    expect(
      checkLine('partnerships', line({ text: 'Approach Tems in London.', names: ['Tems'] }), {
        ...ctx,
        findings: [finding({}), markets],
      }),
    ).toBeNull();
  });

  it('drops a number the findings do not state', () => {
    expect(
      checkLine(
        'markets',
        line({
          text: 'Lagos leads, ahead of London by 1.42.',
          findingIds: ['f-markets'],
          sourceIds: [],
          names: ['Lagos'],
        }),
        ctx,
      ),
    ).toBeNull();
    expect(
      checkLine(
        'markets',
        line({
          text: 'Lagos leads, ahead of London by 1.9.',
          findingIds: ['f-markets'],
          sourceIds: [],
          names: ['Lagos'],
        }),
        ctx,
      ),
    ).toMatch(/1\.9/);
  });

  it('lets a playbook line use launch knowledge, but never claim taste or a market figure', () => {
    const playbook = { kind: 'playbook' as const, findingIds: [], sourceIds: [], group: null };
    expect(
      checkLine('route', { ...playbook, text: 'Watermark every screener.', names: [] }, ctx),
    ).toBeNull();
    expect(
      checkLine(
        'route',
        { ...playbook, text: 'Book the diaspora run through FilmOne.', names: ['FilmOne'] },
        ctx,
      ),
    ).toBeNull();
    expect(
      checkLine('route', { ...playbook, text: 'Afrobeats fans will turn out.', names: [] }, ctx),
    ).toMatch(/audience likes/);
    expect(
      checkLine(
        'route',
        { ...playbook, text: 'January took ₦1.74 billion last year.', names: [] },
        ctx,
      ),
    ).toMatch(/market figure/);
  });

  it('cites the finding behind a name a playbook line uses', () => {
    const playbook = {
      kind: 'playbook' as const,
      findingIds: [],
      sourceIds: [],
      names: [],
      group: null,
    };
    const { sections } = checkSections(
      [
        {
          key: 'partnerships',
          lines: [{ ...playbook, text: 'Open the premiere with a Tems performance.' }],
        },
      ],
      ctx,
    );
    expect(sections[0]?.lines[0]).toMatchObject({
      kind: 'grounded',
      findingIds: ['f-music-lagos'],
      sourceIds: [],
    });
  });

  it('keeps the team’s cities in the bottom line, and lets it lead with a stronger age group', () => {
    expect(
      checkLine(
        'bottom-line',
        line({
          text: 'Open in Lagos first.',
          findingIds: ['f-markets'],
          sourceIds: [],
          names: ['Lagos'],
        }),
        ctx,
      ),
    ).toBeNull();
    expect(
      checkLine(
        'bottom-line',
        {
          kind: 'playbook',
          text: 'Open in Nairobi first.',
          findingIds: [],
          sourceIds: [],
          names: [],
          group: null,
        },
        {
          ...ctx,
          briefNames: [...ctx.briefNames, 'Nairobi'],
        },
      ),
    ).toMatch(/Nairobi/);
    // The bottom line may say who to lead the creative with, even when it is not the team's band.
    expect(
      checkLine(
        'bottom-line',
        line({
          text: 'Lead the creative with people aged 35 to 44.',
          findingIds: ['f-markets'],
          sourceIds: [],
          names: [],
        }),
        { ...ctx, briefText: `${ctx.briefText} 35 44` },
      ),
    ).toBeNull();
  });

  it('drops a percentage made from an index, and misuse of Worth a look', () => {
    expect(
      checkLine(
        'markets',
        line({
          text: 'Lagos holds 42 percent of the audience.',
          findingIds: ['f-markets'],
          sourceIds: [],
          names: ['Lagos'],
        }),
        {
          ...ctx,
          briefText: `${ctx.briefText} 42`,
        },
      ),
    ).toMatch(/percentage/);
    expect(
      checkLine('markets', line({ text: 'Consider Tems.', group: 'Worth a look' }), ctx),
    ).toMatch(/Worth a look/);
  });

  it('reads week markers as the schedule, and lets the bottom line keep the team band beside a stronger one', () => {
    expect(
      checkLine(
        'partnerships',
        line({ text: 'At T-4 weeks, brief Tems; repeat 2 weeks later.' }),
        ctx,
      ),
    ).toBeNull();
    expect(
      checkLine(
        'bottom-line',
        line({
          text: 'Keep 18 to 34, but lead the creative at 35 to 44, where the comps peak.',
          findingIds: ['f-markets'],
          sourceIds: [],
          names: [],
        }),
        { ...ctx, briefText: `${ctx.briefText} 35 44` },
      ),
    ).toBeNull();
  });

  it('never mentions receipts in a plan line', () => {
    expect(checkLine('markets', line({ text: 'See receipt 1 for Tems.' }), ctx)).toMatch(
      /receipts/,
    );
  });
});

describe('names and words that were wrongly refused', () => {
  const church = finding({
    id: 'f-community-church-houston',
    query: 'community',
    text: 'In Houston, the churches that rank highest with your comps’ audience are Dominion Chapel Houston (DCH) and The Fountain of Praise.',
    entities: ['Dominion Chapel Houston (DCH)', 'The Fountain of Praise'].map((name) => ({
      entityId: null,
      name,
      affinity: 0.9,
      detail: null,
    })),
    context: {
      city: 'Houston',
      ages: [],
      tags: ['Church'],
      country: null,
      yearFrom: null,
      audience: null,
    },
  });
  const c = { ...ctx, findings: [church], allowed: ['community' as const] };

  it('matches a venue written with its address or without its abbreviation', () => {
    const base = {
      kind: 'grounded' as const,
      findingIds: ['f-community-church-houston'],
      sourceIds: [],
      group: null,
    };
    const text = 'Ask the church to circulate an optional group-booking invitation.';
    for (const name of [
      'Dominion Chapel Houston (DCH) (1203 Cravens Rd Stafford, TX 77477)',
      'Dominion Chapel Houston',
      'The Fountain of Praise',
    ]) {
      expect(checkLine('community', { ...base, text, names: [name] }, c)).toBeNull();
    }
  });

  it('does not take the word endpoint, in "the campaign’s endpoint", for a call', () => {
    expect(
      checkLine(
        'route',
        {
          kind: 'playbook',
          text: 'Treat the premiere as a start, not the campaign’s endpoint.',
          findingIds: [],
          sourceIds: [],
          names: [],
          group: null,
        },
        ctx,
      ),
    ).toBeNull();
    expect(
      checkLine(
        'route',
        {
          kind: 'playbook',
          text: 'See the Qloo endpoint for details.',
          findingIds: [],
          sourceIds: [],
          names: [],
          group: null,
        },
        ctx,
      ),
    ).toMatch(/receipts or calls/);
  });
});

describe('web sources', () => {
  const web = {
    id: 'w1',
    fact: 'Cinema admissions in the home market reached 3 million in 2025.',
    title: 'Report',
    url: 'https://example.com/report',
  };
  const withSource = { ...ctx, sources: [web] };
  const playbook = { kind: 'playbook' as const, findingIds: [], names: [], group: null };

  it('lets a line state a figure a cited page states, and no other', () => {
    const text = 'Admissions reached 3 million last year, so book wide.';
    expect(checkLine('route', { ...playbook, text, sourceIds: ['w1'] }, withSource)).toBeNull();
    expect(checkLine('route', { ...playbook, text, sourceIds: [] }, withSource)).toMatch(
      /market figure/,
    );
    expect(
      checkLine(
        'route',
        { ...playbook, text: 'Admissions reached 9 million.', sourceIds: ['w1'] },
        withSource,
      ),
    ).toMatch(/9/);
  });

  it('drops a line that cites a source this plan does not have', () => {
    expect(
      checkLine(
        'route',
        { ...playbook, text: 'Avoid the busy weeks.', sourceIds: ['w9'] },
        withSource,
      ),
    ).toMatch(/not a web source/);
  });
});

describe('checkSections', () => {
  it('keeps at most three moves, numbers the lines, and logs every drop', () => {
    const lines = ['Open in Lagos first.', 'Then London.', 'Keep 18 to 34.', 'And more.'].map(
      (text) => ({
        kind: 'playbook' as const,
        text,
        findingIds: [],
        sourceIds: [],
        names: [],
        group: null,
      }),
    );
    const { sections, dropped } = checkSections([{ key: 'bottom-line', lines }], ctx);
    expect(sections[0]?.lines.map((l) => l.id)).toEqual([
      'bottom-line-1',
      'bottom-line-2',
      'bottom-line-3',
    ]);
    expect(dropped).toEqual([
      {
        section: 'bottom-line',
        text: 'And more.',
        why: 'The bottom line has at most three moves.',
      },
    ]);
  });

  it('drops a section the plan does not have', () => {
    const { sections, dropped } = checkSections(
      [
        {
          key: 'cadence',
          lines: [
            line({ kind: 'playbook', findingIds: [], sourceIds: [], names: [], text: 'Weekly.' }),
          ],
        },
      ],
      ctx,
    );
    expect(sections).toEqual([]);
    expect(dropped[0]?.why).toMatch(/section/);
  });
});

describe('the budget band and the creative rule', () => {
  const play = (text: string) => ({
    kind: 'playbook' as const,
    text,
    findingIds: [],
    sourceIds: [],
    names: [],
    group: null,
  });
  const banded = (over: Partial<CheckContext>): CheckContext => ({
    ...ctx,
    flagships: ['Guinness', 'MTN'],
    ...over,
  });

  it('drops a flagship partner a micro or independent budget cannot carry', () => {
    const line = play('Approach Guinness for premiere hospitality in Lagos.');
    expect(checkLine('partnerships', line, banded({ band: 'micro' }))).toMatch(/cannot carry/);
    expect(checkLine('partnerships', line, banded({ band: 'independent' }))).toMatch(
      /cannot carry/,
    );
  });

  it('keeps it for a mid-size budget, or when the team already signed the partner', () => {
    const line = play('Approach Guinness for premiere hospitality in Lagos.');
    expect(checkLine('partnerships', line, banded({ band: 'mid' }))).toBeNull();
    expect(
      checkLine('partnerships', line, banded({ band: 'micro', teamPartners: ['Guinness'] })),
    ).toBeNull();
  });

  it('drops a line that offers to make the trailer, and keeps one that briefs it', () => {
    const offer = play('We will generate the trailer for each territory.');
    const brief = play('Write the trailer script and a shot list for the lead territory.');
    expect(checkLine('partnerships', offer, ctx)).toMatch(/guide or script/);
    expect(checkLine('partnerships', brief, ctx)).toBeNull();
  });
});

describe('checkLine and the team’s results', () => {
  const results = (text: string) =>
    line({ kind: 'playbook', findingIds: [], names: [], text, group: 'Your results' });

  it('drops a cause stated as fact', () => {
    for (const text of [
      'Houston finished first because the trailer ran there.',
      'London fell behind due to the late release.',
      'This is why Lagos did best.',
    ]) {
      expect(checkLine('route', results(text), ctx), text).toMatch(/states a cause/);
    }
  });

  it('keeps what happened and a cause put as a hypothesis', () => {
    for (const text of [
      'Houston finished first in your results.',
      'One reading is that the trailer ran there; that is a hypothesis to test.',
    ]) {
      expect(checkLine('route', results(text), ctx), text).toBeNull();
    }
  });

  it('leaves the same words alone outside the results group', () => {
    const other = line({
      kind: 'playbook',
      findingIds: [],
      names: [],
      text: 'Open early because the window is short.',
      group: null,
    });
    expect(checkLine('route', other, ctx)).toBeNull();
  });
});

describe('a grounded line carries only names its sources account for', () => {
  const grounded = (text: string, over: Partial<Parameters<typeof checkLine>[1]> = {}) =>
    line({ text, names: [], findingIds: ['f-music-lagos'], ...over });

  it('drops a university or neighbourhood from memory that sits beside a valid citation', () => {
    for (const text of [
      'Pitch Tems at Georgia State University and the local campus radio.',
      'Tems reaches this audience around Lagos State University and the Yaba Tech Park.',
    ]) {
      expect(checkLine('partnerships', grounded(text), ctx), text).toMatch(
        /names .*, which no finding/,
      );
    }
  });

  it('keeps a multi word name its finding, the brief, a page or the city table gives', () => {
    const withPage = {
      ...ctx,
      sources: [
        {
          id: 'w1',
          url: 'https://news.example/a',
          title: 'A',
          fact: 'Silverbird Cinemas opened a new screen in Lagos.',
        },
      ],
    } as unknown as CheckContext;
    expect(
      checkLine('partnerships', grounded('Burna Boy and Tems lead for Third Bridge.'), ctx),
    ).toBeNull();
    expect(
      checkLine(
        'partnerships',
        grounded('Silverbird Cinemas fits Tems for the premiere.', { sourceIds: ['w1'] }),
        withPage,
      ),
    ).toBeNull();
  });

  it('does not count the first word of a sentence as part of a name', () => {
    expect(
      checkLine('partnerships', grounded('Open Lagos first. Approach Tems for the single.'), ctx),
    ).toBeNull();
  });

  it('lets the same name through in a playbook line, which claims nothing about taste', () => {
    expect(
      checkLine(
        'route',
        line({
          kind: 'playbook',
          findingIds: [],
          names: [],
          text: 'Send the screener to Georgia State University film society.',
        }),
        ctx,
      ),
    ).toBeNull();
  });
});

describe('numbers come from the findings a line cites', () => {
  it('drops a number only an uncited finding states', () => {
    const line2 = line({
      text: 'Lagos leads with a score of 1.42 for the premiere.',
      names: ['Lagos'],
      findingIds: ['f-music-lagos'],
    });
    expect(checkLine('markets', line2, ctx)).toMatch(/1\.42/);
    expect(checkLine('markets', { ...line2, findingIds: ['f-markets'] }, ctx)).toBeNull();
  });
});

describe('a name written in another case or without its brackets still gets its finding', () => {
  it('cites the finding for a book shop written in lower case with its bracket left off', () => {
    const shops = finding({
      id: 'f-bookshops',
      query: 'bookshops',
      text: 'In London, the book shops this audience likes are Word On The Water and John Sandoe (Books).',
      entities: ['Word On The Water', 'John Sandoe (Books)'].map((name) => ({
        entityId: null,
        name,
        affinity: 0.8,
        detail: null,
      })),
      context: {
        city: 'London',
        ages: [],
        tags: [],
        country: null,
        yearFrom: null,
        audience: null,
      },
    });
    const withShops = { ...ctx, findings: [...ctx.findings, shops] };
    const { sections } = checkSections(
      [
        {
          key: 'route',
          lines: [
            {
              kind: 'playbook',
              text: 'Hold a second event at John Sandoe or Word on the Water.',
              findingIds: [],
              sourceIds: [],
              names: [],
              group: null,
            },
          ],
        },
      ],
      { ...withShops, allowed: ['route'] },
    );
    expect(sections[0]?.lines[0]?.findingIds).toEqual(['f-bookshops']);
    expect(sections[0]?.lines[0]?.kind).toBe('grounded');
  });
});

describe('a sentence word and an article are not part of a name', () => {
  it('reads "Keep the Third Bridge deal" as Third Bridge, which the brief names', () => {
    const l = line({
      text: 'Keep the Third Bridge premiere in Lagos, and approach Tems for the single.',
      names: ['Tems'],
    });
    expect(checkLine('partnerships', l, ctx)).toBeNull();
  });
});
