import type { Category, Project } from '@oraqul/schema';
import type { DPlace } from './types';

type PlaceRow = Omit<DPlace, 'id' | 'name'>;

export const PLACES: Record<Category, Record<string, PlaceRow>> = {
  film: {
    UK: {
      lift: 1.9,
      date: 'Nov 20',
      aud: 'Women 18 to 34, men 18 to 24',
      conf: 'high',
      note: 'London first, Manchester second week.',
    },
    Canada: {
      lift: 1.6,
      date: 'Nov 20',
      aud: 'Women 25 to 34',
      conf: 'high',
      note: 'Toronto first, Vancouver second.',
    },
    US: {
      lift: 1.4,
      date: 'Nov 13',
      aud: 'Women 18 to 34',
      conf: 'high',
      note: 'Lead with Austin and Chicago.',
    },
    Mexico: {
      lift: 1.5,
      date: 'Dec 4',
      aud: 'Men and women 25 to 34',
      conf: 'lower',
      note: 'Few comparable titles were found for Mexico. The plan rests on comps and cast, treat it as a draft.',
    },
    Germany: {
      lift: 1.2,
      date: 'Dec 11',
      aud: 'Men and women 25 to 44',
      conf: 'medium',
      note: 'Berlin first, subtitled prints.',
    },
    Brazil: {
      lift: 1.3,
      date: 'Dec 11',
      aud: 'Men and women 18 to 34',
      conf: 'lower',
      note: 'Coverage for this territory is not tested in this demo.',
    },
  },
  music: {
    London: {
      lift: 1.7,
      date: 'Nov 14',
      aud: 'Superfans and genre fans 25 to 34',
      conf: 'high',
      note: 'Opening night. Strong superfan base.',
    },
    Austin: {
      lift: 1.1,
      date: 'Nov 21',
      aud: 'Genre fans 25 to 44',
      conf: 'medium',
      note: 'Planned as the second biggest city. The data says otherwise.',
    },
    Toronto: {
      lift: 1.5,
      date: 'Nov 24',
      aud: 'Superfans 25 to 34',
      conf: 'high',
      note: 'Highest lift outside London.',
    },
    'Mexico City': {
      lift: 1.4,
      date: 'Dec 20',
      aud: 'Indie pop listeners 18 to 34',
      conf: 'lower',
      note: 'Newest market. Few Mexico City venues came back, so treat it as a draft.',
    },
    Seoul: {
      lift: 1.0,
      date: 'Dec 23',
      aud: 'Indie pop listeners 18 to 34',
      conf: 'lower',
      note: 'Thin data. Treat as a draft.',
    },
    Chicago: {
      lift: 1.5,
      date: 'Nov 21',
      aud: 'Genre fans 25 to 34',
      conf: 'medium',
      note: 'A stronger fit than Austin.',
    },
  },
  books: {
    UK: {
      lift: 1.5,
      date: 'Mar 4',
      aud: 'Book club readers 35 to 54',
      conf: 'high',
      note: 'Launch in London, festival in the second week.',
    },
    US: {
      lift: 1.6,
      date: 'Mar 11',
      aud: 'Book club readers 35 to 54, thriller readers',
      conf: 'high',
      note: 'Coastal states first.',
    },
    Mexico: {
      lift: 1.2,
      date: 'Mar 25',
      aud: 'Literary readers 25 to 34',
      conf: 'lower',
      note: 'Few comparable books were found for Mexico. Treat as a draft.',
    },
    Canada: {
      lift: 1.3,
      date: 'Mar 18',
      aud: 'Book club readers 35 to 54',
      conf: 'medium',
      note: 'Toronto and Vancouver.',
    },
  },
  podcasts: {
    UK: {
      lift: 1.3,
      aud: 'Home cooks 25 to 34',
      conf: 'high',
      note: 'The plan treats the UK as the lead market.',
    },
    US: {
      lift: 1.5,
      aud: 'Travel listeners 25 to 44',
      conf: 'high',
      note: 'Strong, and not the lead market in the plan.',
    },
    Mexico: {
      lift: 1.1,
      aud: 'Listeners 25 to 34',
      conf: 'lower',
      note: 'Thin data. Do not reuse the UK audience here.',
    },
    Canada: {
      lift: 1.2,
      aud: 'Home cooks 25 to 34',
      conf: 'medium',
      note: 'Toronto and Montreal.',
    },
  },
  games: {
    Brazil: {
      lift: 1.7,
      aud: 'Co op players 18 to 24',
      conf: 'medium',
      note: 'Planned as a minor region. Lift says it is the strongest.',
    },
    US: {
      lift: 1.3,
      aud: 'Survival crafting fans 25 to 34',
      conf: 'high',
      note: 'The planned lead region.',
    },
    Japan: {
      lift: 1.3,
      aud: 'Console players 25 to 34',
      conf: 'medium',
      note: 'Needs its own plan and store page.',
    },
    Germany: {
      lift: 1.2,
      aud: 'Co op players 25 to 34',
      conf: 'high',
      note: 'Steady, not a standout.',
    },
  },
  shows: {},
};

// A show is staged in the cities a music audience is placed in, so the demo reuses those rows.
PLACES.shows = { ...PLACES.music };

export function placeRow(category: Category, name: string, id: string): DPlace | undefined {
  const row = PLACES[category][name];
  return row ? { id, name, ...row } : undefined;
}

export function placesFor(r: Project): DPlace[] {
  return r.places.map(
    (name, i) =>
      placeRow(r.category, name, `pl${i + 1}`) ?? {
        id: `pl${i + 1}`,
        name,
        lift: 1.0,
        aud: 'Same as the main plan until tested',
        conf: 'lower',
        note: 'Coverage for this place is not tested in this demo.',
      },
  );
}
