import { describe, expect, it } from 'vitest';
import { buildBrief, DETAILS, emptyValues, filled } from './brief';

const full = {
  ...emptyValues('film'),
  title: 'Night Ferry',
  about: 'a thriller',
  country: 'Nigeria',
  release: '2099-03-12',
  cities: 'Lagos, London, Houston, Atlanta',
  ages: '18 to 34 year olds',
  comps: 'Salt Road, The Glass Lantern',
  band: 'mid' as const,
  target: '5000',
  rivals: [
    { title: 'Harbor Lights', date: '2099-03-12' },
    { title: '', date: '' },
  ],
  partners: 'MTN',
  channels: 'WhatsApp, Instagram',
  extras: { route: 'Cinemas first' },
};

describe('buildBrief', () => {
  it('writes the forms Oraqul reads without guessing', () => {
    const text = buildBrief(full);
    expect(text).toContain(
      'Launch plan for the film "Night Ferry", a thriller from Nigeria for 18 to 34 year olds, opening in Lagos, London, Houston and Atlanta on 2099-03-12.',
    );
    expect(text).toContain('Comps: "Salt Road", "The Glass Lantern".');
    expect(text).toContain('A mid-size budget.');
    expect(text).toContain('Target 5000 presales.');
    expect(text).toContain('Rivals: Harbor Lights on 2099-03-12');
    expect(text).toContain('Partners already signed: MTN.');
    expect(text).toContain('Release route: Cinemas first.');
  });

  it('leaves no trace of an empty field', () => {
    const text = buildBrief({ ...emptyValues('games'), title: 'Ember Keep' });
    expect(text).toBe('Launch plan for the game "Ember Keep".');
  });

  it('drops a rival without a valid day, and keeps the unit a person typed', () => {
    const text = buildBrief({
      ...emptyValues('games'),
      title: 'Ember Keep',
      target: '10,000 wishlists',
      rivals: [{ title: 'Other', date: 'March' }],
    });
    expect(text).not.toContain('Rivals');
    expect(text).toContain('Target 10,000 wishlists.');
  });

  it('puts a pasted plan after the details when checking or fixing one', () => {
    const text = buildBrief({
      ...emptyValues('music'),
      mode: 'audit',
      title: 'Night Songs',
      plan: 'Open in Lagos, then London.',
    });
    expect(text.startsWith('Our plan for the release "Night Songs".')).toBe(true);
    expect(text.endsWith('Open in Lagos, then London.')).toBe(true);
  });
});

describe('filled', () => {
  it('counts each detail the plan is better for', () => {
    const got = filled(full);
    expect(DETAILS.every((d) => got[d.id])).toBe(true);
    const none = filled(emptyValues());
    expect(DETAILS.some((d) => none[d.id])).toBe(false);
  });
});
