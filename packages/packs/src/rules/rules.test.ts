import { describe, expect, it } from 'vitest';
import { TASTE_CLAIM } from '../launch';
import {
  ASSET_OFFER,
  bandCarries,
  bandOf,
  CALENDAR_ADS,
  CALENDAR_RULES,
  CATEGORY_PARTNERS,
  FLAGSHIPS,
  leadChannels,
  PARTNER_RULES,
  SHARED_RULES,
  platformsNamed,
  rules,
  suggestPlatforms,
} from './index';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe('rule library', () => {
  const libs = Object.values(rules);

  it('gives every rule a source and a date', () => {
    for (const lib of libs) {
      for (const r of [...lib.timeline, lib.signal, lib.channels]) {
        expect(r.source.label, r.id).toBeTruthy();
        expect(r.source.date, r.id).toMatch(ISO);
      }
      expect(lib.version.startsWith(`${lib.category}@`)).toBe(true);
    }
  });

  it('has unique versions and rule ids', () => {
    expect(new Set(libs.map((l) => l.version)).size).toBe(libs.length);
    const ids = libs.flatMap((l) => [...l.timeline, l.signal, l.channels].map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps playbook beats free of taste claims', () => {
    for (const lib of libs) {
      for (const b of lib.beats) expect(TASTE_CLAIM.test(b.text), b.key).toBe(false);
    }
  });

  it('works film and music back from the release (D1)', () => {
    expect(Math.min(...rules.film.beats.map((b) => b.at))).toBeLessThanOrEqual(-24);
    const music = rules.music.beats;
    expect(Math.min(...music.map((b) => b.at))).toBe(-8);
    expect(Math.max(...music.map((b) => b.until ?? b.at))).toBeLessThanOrEqual(4);
  });

  it('names one primary signal, and a target only for games (D2)', () => {
    expect(rules.games.signal.value.benchmark).toEqual({
      value: 7000,
      floor: 5000,
      unit: 'wishlists',
    });
    for (const c of ['film', 'music', 'books', 'podcasts'] as const) {
      expect(rules[c].signal.value.benchmark).toBeNull();
    }
    expect(rules.podcasts.signal.value.checkpoints).toEqual([30, 60]);
  });

  it('rises through the budget bands (D6)', () => {
    expect(bandOf(5_000, 'USD')).toBe('micro');
    expect(bandOf(50_000, 'USD')).toBe('independent');
    expect(bandOf(500_000, 'USD')).toBe('mid');
    expect(bandOf(5_000_000, 'USD')).toBe('major');
    expect(bandOf(50_000_000, 'NGN')).toBe('independent');
  });

  it('offers flagship partners only to a release with scale (D9)', () => {
    expect(bandCarries('micro', 'A')).toBe(false);
    expect(bandCarries('independent', 'A')).toBe(false);
    expect(bandCarries('mid', 'A')).toBe(true);
    expect(bandCarries('micro', 'C')).toBe(true);
  });

  it('leads Nigerian launches on public platforms and never on WhatsApp (D7)', () => {
    expect(leadChannels('music', 'Nigeria').slice(0, 2)).toEqual(['Instagram', 'TikTok']);
    expect(leadChannels('film', 'Nigeria')).not.toContain('WhatsApp');
    expect(leadChannels('film', null)[0]).toBe('YouTube');
    expect(leadChannels('books', null)[0]).toBe('TikTok');
  });
});

describe('platform suggestions (D7)', () => {
  const names = (country: string | null, category: 'film' | 'games' = 'film') =>
    suggestPlatforms(category, country).map((p) => p.name);

  it('offers a spread of platforms for Nigeria, with WhatsApp last as a sharing layer', () => {
    const nigeria = names('Nigeria');
    expect(nigeria.length).toBeGreaterThanOrEqual(5);
    expect(nigeria.slice(0, 3)).toEqual(['Instagram', 'TikTok', 'YouTube']);
    expect(nigeria).toContain('X');
    expect(nigeria.at(-1)).toBe('WhatsApp');
    expect(new Set(nigeria).size).toBe(nigeria.length);
  });

  it('does not offer WhatsApp in a market that does not pass launches around on it', () => {
    expect(names('United States')).not.toContain('WhatsApp');
  });

  it('adds the category’s own homes, such as Discord for games', () => {
    expect(names(null, 'games')).toEqual(expect.arrayContaining(['YouTube', 'Discord']));
  });

  it('reads the platforms a brief names', () => {
    expect(platformsNamed('Channels: WhatsApp, Instagram and TikTok')).toEqual([
      'Instagram',
      'TikTok',
      'WhatsApp',
    ]);
    expect(platformsNamed('a launch on Twitter')).toEqual(['X']);
    expect(platformsNamed('an expert on the x factor')).toEqual([]);
  });
});

describe('shared, partner and calendar rules', () => {
  const sources = [
    ...Object.values(SHARED_RULES).filter((r) => typeof r === 'object' && 'source' in r),
    ...Object.values(CATEGORY_PARTNERS),
    PARTNER_RULES.seeds,
    PARTNER_RULES.tier,
    PARTNER_RULES.slots,
    PARTNER_RULES.leadTime,
    PARTNER_RULES.pitch,
    ...Object.values(CALENDAR_RULES.categories),
    CALENDAR_RULES.ads,
  ];

  it('gives every rule a source, a grade and a date', () => {
    for (const r of sources) {
      expect(r.source.label, r.id).toBeTruthy();
      expect(r.source.date, r.id).toMatch(ISO);
      expect(['team', 'directional', 'not-researched'], r.id).toContain(r.source.grade);
    }
  });

  it('has unique rule ids', () => {
    const ids = sources.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps calendar rows and partner wording free of taste claims and asset offers', () => {
    const texts = [
      ...Object.values(CALENDAR_RULES.categories).flatMap((r) =>
        r.value.rows.flatMap((x) => [x.post, x.asset ?? '']),
      ),
      ...CALENDAR_ADS.value.lines,
      ...Object.values(CATEGORY_PARTNERS).flatMap((r) => [...r.value.gets, ...r.value.ideas]),
    ];
    for (const t of texts) {
      expect(TASTE_CLAIM.test(t), t).toBe(false);
      expect(ASSET_OFFER.test(t), t).toBe(false);
    }
  });

  it('holds no post counts for categories nobody researched', () => {
    for (const c of ['books', 'podcasts', 'games'] as const) {
      const r = CALENDAR_RULES.categories[c];
      expect(r.source.grade).toBe('not-researched');
      expect(r.value.rows).toEqual([]);
      expect(r.value.fromBeats).toBe(true);
    }
  });

  it('marks film and music directional and the ads note directional', () => {
    expect(CALENDAR_RULES.categories.film.source.grade).toBe('directional');
    expect(CALENDAR_RULES.categories.music.source.grade).toBe('directional');
    expect(CALENDAR_RULES.ads.source.grade).toBe('directional');
  });

  it('asks Qloo only for brand categories a probe verified', () => {
    for (const r of Object.values(CATEGORY_PARTNERS)) {
      for (const c of r.value.brandCategories) {
        if (!c.verified) continue;
        expect(['beverage', 'telecom']).toContain(c.phrase);
      }
    }
  });

  it('reserves slots for every tier and names flagships only in the seeds', () => {
    expect(PARTNER_RULES.slots.value.C).toBeGreaterThan(0);
    expect(FLAGSHIPS).toEqual(expect.arrayContaining(['Guinness', 'MTN', 'Indomie']));
  });
});
