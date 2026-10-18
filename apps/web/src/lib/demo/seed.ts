import type { Category, Project, Thread } from '@oraqul/schema';
import { dedupe, diffIds, lcf, splitList } from './brief';
import type { DOutput } from './build-output';
import { applyRescue, auditBrief, mkOut, mkThread, traceForScenario, withSeedClock } from './flows';
import { uuidFrom } from './ids';
import { PACKS } from './packs';
import { getState, insertProject, markRead, patchProject, pushItem } from './store';

interface SeedProject {
  key: string;
  category: Category;
  name: string;
  kind: string;
  genre: string;
  status: string;
  places: string[];
  window: string;
  lead: string;
  comps: string;
  updated: string;
  first: 'build' | 'audit';
  extras: ('date' | 'partner')[];
  second?: { kind: 'scenario'; id: string } | { kind: 'rescue' };
}

const SEEDS: SeedProject[] = [
  {
    key: 'r1',
    category: 'film',
    name: 'Salt Road',
    kind: 'Film',
    genre: 'Crime drama',
    status: 'Opened, ready for rescue',
    places: ['UK', 'Canada', 'Mexico'],
    window: 'Nov 2026',
    lead: 'Nia Calloway, Teo Brandt',
    comps: 'Low Tide Letters, Paper Harbour',
    updated: '2026-10-06',
    first: 'build',
    extras: ['date', 'partner'],
    second: { kind: 'scenario', id: 'rival' },
  },
  {
    key: 'r2',
    category: 'film',
    name: 'Harbour Lights',
    kind: 'Series',
    genre: 'Crime drama',
    status: 'Audit',
    places: ['UK', 'Mexico'],
    window: 'Jan 2027',
    lead: 'Min-jun Park, Clara Voss',
    comps: 'Grey Tide, The Ferry Office',
    updated: '2026-10-03',
    first: 'audit',
    extras: [],
  },
  {
    key: 'r3',
    category: 'music',
    name: 'Neon Hours tour',
    kind: 'Tour',
    genre: 'Indie pop',
    status: 'Audit',
    places: ['London', 'Austin', 'Toronto', 'Mexico City', 'Seoul'],
    window: 'Nov to Dec 2026',
    lead: 'Mara Delano',
    comps: 'Tomas Marlow, Sadie Kline',
    updated: '2026-10-09',
    first: 'audit',
    extras: ['date'],
    second: { kind: 'scenario', id: 'swap' },
  },
  {
    key: 'r4',
    category: 'music',
    name: 'Neon Hours, the album',
    kind: 'Album',
    genre: 'Indie pop',
    status: 'Planning',
    places: ['London', 'Toronto', 'Mexico City'],
    window: 'Oct 2026',
    lead: 'Mara Delano',
    comps: 'Tomas Marlow, Sadie Kline',
    updated: '2026-10-05',
    first: 'build',
    extras: [],
  },
  {
    key: 'r5',
    category: 'books',
    name: 'Harbour Season',
    kind: 'Novel',
    genre: 'Literary thriller',
    status: 'Planning',
    places: ['UK', 'US', 'Mexico'],
    window: 'Mar 2027',
    lead: 'Priya Nair',
    comps: 'The Quiet Tide, Ash and Orchard',
    updated: '2026-10-08',
    first: 'build',
    extras: ['partner'],
    second: { kind: 'scenario', id: 'thriller' },
  },
  {
    key: 'r6',
    category: 'podcasts',
    name: 'The Long Table',
    kind: 'Season two',
    genre: 'Food and travel stories',
    status: 'Replanned after results',
    places: ['UK', 'US', 'Mexico'],
    window: 'Season two, Sep 2026',
    lead: 'Lena and Marco Rossi',
    comps: 'Kitchen Tongues, Taste of Home Radio',
    updated: '2026-10-07',
    first: 'build',
    extras: [],
    second: { kind: 'rescue' },
  },
  {
    key: 'r7',
    category: 'games',
    name: 'Ember Quay',
    kind: 'Co op survival game',
    genre: 'Survival crafting',
    status: 'Planning',
    places: ['US', 'Germany', 'Japan', 'Brazil'],
    window: 'Dec 2026',
    lead: 'Quayside Games',
    comps: 'Tidal Hollow, Cairn Keepers',
    updated: '2026-10-10',
    first: 'build',
    extras: ['date'],
    second: { kind: 'scenario', id: 'anime' },
  },
  {
    key: 'r8',
    category: 'music',
    name: 'Night Shift EP',
    kind: 'EP',
    genre: 'Dream pop',
    status: 'Planning',
    places: ['London', 'Mexico City'],
    window: 'Nov 2026',
    lead: 'Dani Roe',
    comps: 'Sadie Kline, Tomas Marlow',
    updated: '2026-10-08',
    first: 'build',
    extras: [],
  },
];

const DAY_ONE = '2026-10-08T10:00:00.000Z';
const DAY_TWO = '2026-10-09T10:00:00.000Z';

function seedChat(r: Project, t: Thread, made: DOutput[]): void {
  const pk = PACKS[r.category];
  made.forEach((o, i) => {
    const asked = {
      build: 'Plan the launch.',
      audit: 'Audit our plan.',
      scenario: `Run scenario: ${o.title.replace('Scenario: ', '')}`,
      date: 'Check the dates.',
      partner: `Draft the ${pk.partnerWord} brief.`,
      rescue: 'Add the results.',
    }[o.kind];
    const steps =
      o.kind === 'scenario'
        ? traceForScenario(o.title.replace('Scenario: ', ''))
        : pk.trace[o.kind].slice();
    const summary = getState().outputs.find((x) => x.id === o.id)?.summary ?? '';
    const key = `${t.id}-${i}`;
    pushItem(t.id, { id: `${key}-u`, role: 'user', text: asked });
    pushItem(t.id, { id: `${key}-t`, role: 'trace', steps, done: steps.length, findings: [] });
    pushItem(t.id, { id: `${key}-a`, role: 'agent', text: summary });
    pushItem(t.id, { id: `${key}-o`, role: 'output', outputId: o.id });
  });
  markRead(t.id);
}

/** Builds the sample team's projects, threads and outputs. Runs once per module load. */
export function seed(): void {
  for (const s of SEEDS.slice().reverse()) {
    const r: Project = {
      id: uuidFrom(`project:${s.key}`),
      category: s.category,
      name: s.name,
      kind: s.kind,
      genre: s.genre,
      places: s.places,
      window: s.window,
      lead: s.lead,
      comps: splitList(s.comps),
      status: s.status,
      updatedAt: `${s.updated}T12:00:00.000Z`,
      qlooMatch: null,
      extra: {},
    };
    insertProject(r);
    const pk = PACKS[s.category];
    withSeedClock(DAY_ONE, () => {
      const audit = s.first === 'audit';
      const t1 = mkThread(
        r,
        audit ? 'Audit of the plan' : 'Launch plan',
        null,
        'Amara',
        DAY_ONE,
        `thread:${s.key}:1`,
      );
      const o1 = audit
        ? mkOut(
            r,
            t1,
            'audit',
            'Audit of your plan',
            auditBrief(r),
            { by: 'Amara' },
            `output:${s.key}:1`,
          )
        : mkOut(r, t1, 'build', 'First plan', pk.base(r), { by: 'Amara' }, `output:${s.key}:1`);
      const made = [o1];
      for (const extra of s.extras) {
        if (extra === 'date') {
          made.push(
            mkOut(
              r,
              t1,
              'date',
              pk.dateTitle,
              o1.brief,
              {
                by: 'Amara',
                ofId: o1.id,
                focusIds: o1.brief.dates.map((d) => d.id),
                src: 'calendar',
              },
              `output:${s.key}:date`,
            ),
          );
        }
        const partner = o1.brief.partners[0];
        if (extra === 'partner' && partner) {
          made.push(
            mkOut(
              r,
              t1,
              'partner',
              `${partner.name} brief`,
              o1.brief,
              { by: 'Amara', ofId: o1.id, focusIds: [partner.id] },
              `output:${s.key}:partner`,
            ),
          );
        }
      }
      seedChat(r, t1, made);

      if (!s.second) return;
      withSeedClock(DAY_TWO, () => {
        if (s.second?.kind === 'scenario') {
          const id = s.second.id;
          const scenario = pk.scen.find((x) => x.id === id);
          if (!scenario) throw new Error(`Seed scenario ${id} is not in the ${s.category} pack`);
          const t2 = mkThread(
            r,
            `What if ${lcf(scenario.label)}`,
            o1.id,
            'Dan',
            DAY_TWO,
            `thread:${s.key}:2`,
          );
          const b2 = structuredClone(o1.brief);
          scenario.apply(b2);
          dedupe(b2);
          const o2 = mkOut(
            r,
            t2,
            'scenario',
            `Scenario: ${scenario.label}`,
            b2,
            { parentId: o1.id, changed: diffIds(o1.brief, b2), by: 'Dan' },
            `output:${s.key}:2`,
          );
          seedChat(r, t2, [o2]);
        } else {
          const t2 = mkThread(
            r,
            'Results and relaunch',
            o1.id,
            'Dan',
            DAY_TWO,
            `thread:${s.key}:2`,
          );
          const nb = structuredClone(o1.brief);
          const x = pk.res;
          const labels = x.tLabels(r);
          applyRescue(r, nb, {
            date: x.confirmRows[0]?.[1] ?? '',
            a: x.demoA(r),
            t: labels ? labels.map((label, i) => ({ label, share: x.demoT(r)[i] ?? 0 })) : null,
            hold: x.holdDefault,
          });
          dedupe(nb);
          const o2 = mkOut(
            r,
            t2,
            'rescue',
            'Rescue: results',
            nb,
            { parentId: o1.id, changed: diffIds(o1.brief, nb), by: 'Dan' },
            `output:${s.key}:2`,
          );
          seedChat(r, t2, [o2]);
        }
      });
    });
    // Saving outputs touches the project; the sample keeps its own "updated" date.
    patchProject(r.id, { updatedAt: r.updatedAt });
  }
}
