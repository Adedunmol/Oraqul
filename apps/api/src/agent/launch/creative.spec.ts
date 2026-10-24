import { refusalFor } from '@oraqul/packs';
import type { Finding, LaunchPlan, Territory } from '@oraqul/schema';
import { launchPlanSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { checkLine } from './check.js';
import { buildKit, KIT_SECTIONS, kitTarget, kitTargets } from './creative.js';
import { askedCreative } from './follow-up.js';
import type { WrittenLine } from './writer.js';

const finding = (over: Partial<Finding>): Finding => ({
  id: 'f-x',
  query: 'themes',
  text: 'A finding.',
  entities: [],
  numbers: {},
  verdict: null,
  confidence: 'high',
  why: '',
  context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: ['00000000-0000-4000-8000-000000000001'],
  ...over,
});
const entity = (name: string) => ({ entityId: null, name, affinity: 0.9, detail: null });

const territory = (name: string, channels: string[]): Territory => ({
  id: `territory-${name.toLowerCase()}`,
  name,
  role: 'home',
  order: 0,
  callId: null,
  channels: channels.map((c, i) => ({ name: c, lead: i < 3 })),
  partnerIds: [],
  lineIds: [],
});

const plan: LaunchPlan = launchPlanSchema.parse({
  scope: 'full',
  sections: [],
  comps: [],
  findings: [
    finding({
      id: 'f-themes',
      query: 'themes',
      entities: ['Survival', 'Community', 'Loyalty'].map(entity),
    }),
    finding({
      id: 'f-cinemas-lagos',
      query: 'cinemas',
      entities: ['Marina Picturehouse', 'Lekki Screens'].map(entity),
      context: { city: 'Lagos', ages: [], tags: [], country: null, yearFrom: null, audience: null },
    }),
  ],
  dropped: [],
  writer: 'template',
  territories: [
    territory('Lagos', ['WhatsApp', 'Instagram', 'TikTok']),
    territory('London', ['YouTube']),
  ],
});

describe('kitTarget', () => {
  it('picks the territory and channel the message names, else the first of each', () => {
    const named = kitTarget('Make the creative kit for London on YouTube', plan);
    expect([named?.territory.name, named?.channel]).toEqual(['London', 'YouTube']);
    const open = kitTarget('Make the creative kit', plan);
    expect([open?.territory.name, open?.channel]).toEqual(['Lagos', 'WhatsApp']);
  });

  it('has no target when the plan has no territory', () => {
    expect(kitTarget('creative kit', { ...plan, territories: [] })).toBeNull();
  });
});

describe('kitTargets: the kit for every territory', () => {
  it('is one target unless the message asks for every territory', () => {
    expect(
      kitTargets('Make the creative kit for London', plan).map((t) => t.territory.name),
    ).toEqual(['London']);
  });

  it('covers each territory on its own lead channel when asked for all of them', () => {
    for (const text of [
      'Make the creative kit for every territory',
      'creative kit for all territories',
      'creative kit for each city',
      'make the creative kit for all my markets',
    ]) {
      const all = kitTargets(text, plan);
      expect(
        all.map((t) => [t.territory.name, t.channel]),
        text,
      ).toEqual([
        ['Lagos', 'WhatsApp'],
        ['London', 'YouTube'],
      ]);
    }
  });

  it('uses the channel the message names where a territory has it', () => {
    const all = kitTargets('creative kit for every territory on Instagram', plan);
    expect(all.map((t) => t.channel)).toEqual(['Instagram', 'YouTube']);
  });

  it('has no target when the plan has no territory', () => {
    expect(kitTargets('creative kit for every territory', { ...plan, territories: [] })).toEqual(
      [],
    );
  });
});

describe('buildKit (D8)', () => {
  const sections = buildKit({
    category: 'film',
    title: 'Night Ferry',
    plan,
    territory: plan.territories[0] as Territory,
    channel: 'WhatsApp',
    release: '2099-03-12',
  });
  const ctx = {
    rules: { titles: {} as never, tasteClaim: /\b(fans?|likes?)\b/i, tagOnly: ['themes'] },
    findings: plan.findings,
    sources: [],
    briefNames: ['Night Ferry', 'Lagos'],
    briefText: '2099-03-12',
    teamCities: ['Lagos'],
    teamAges: [],
    allowed: [...KIT_SECTIONS],
  };

  it('writes a section for each guide, grouped by territory and channel', () => {
    expect(sections.map((s) => s.key)).toEqual([...KIT_SECTIONS]);
    expect(sections.every((s) => s.lines.every((l) => l.group === 'Lagos · WhatsApp'))).toBe(true);
  });

  it('writes guides only: no line offers to make the asset', () => {
    const text = sections.flatMap((s) => s.lines.map((l) => l.text)).join('\n');
    expect(text).toContain('Oraqul does not draw it');
    expect(text).toContain('a clip under a minute that is easy to forward');
    expect(refusalFor(text)).toBeNull();
  });

  it('cites a finding only for the tone and the places, and the line check accepts every line', () => {
    const lines = sections.flatMap((s) => s.lines.map((l) => ({ section: s.key, line: l })));
    const grounded = lines.filter((l) => l.line.kind === 'grounded');
    expect(grounded.map((g) => g.line.findingIds[0]).sort()).toEqual([
      'f-cinemas-lagos',
      'f-themes',
    ]);
    for (const { section, line } of lines) {
      expect(checkLine(section, line as WrittenLine, ctx), line.text).toBeNull();
    }
  });
});

describe('asking for the creative (D8)', () => {
  it('reads a request for the kit and its parts in plain words', () => {
    for (const text of [
      'Make the creative kit for Lagos',
      'I need a shot list and caption pack',
      'Write the trailer script for London',
      'Give me hook options',
    ]) {
      expect(askedCreative(text), text).toBe(true);
    }
    expect(askedCreative('What if we open in Accra first?')).toBe(false);
  });

  it('refuses to make the asset, and still writes the guide for it', () => {
    for (const text of [
      'Generate the trailer for my film',
      'make me a 30 second ad',
      'Can you create a poster image',
      'design a logo and a banner',
    ]) {
      expect(refusalFor(text), text).toMatch(/I don't make ads, trailers, images or video/);
    }
    for (const text of [
      'Write a trailer script for Lagos',
      'make a trailer shot list',
      'Create a launch plan for a film with a trailer in March',
      'make the creative kit for Lagos on TikTok',
    ]) {
      expect(refusalFor(text), text).toBeNull();
    }
  });
});
