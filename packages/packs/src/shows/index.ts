import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const shows: CategoryPack = {
  category: 'shows',
  title: 'Live shows',
  blurb: 'A single show or a short run, planned from the show date back.',
  covers:
    'a single live show or a short run: a concert, a comedy night, a club night, a stage play, or a one night premiere or screening event. Not festivals, full tours, routing, venue logistics or booking a lineup',
  systemPrompt:
    'You are the live shows agent. Read the lead as an act, and the launch as one show or a short run of a kind: concert, comedy night, club night, stage play or screening. Treat the act as the strongest signal when Qloo knows it, and comparable acts as the comps when it does not. The show date, the venue capacity, the ticket price band, the budget band and rival show dates are the team’s to supply: Qloo holds none of them, so never invent one and say not available when it is missing. Tickets sold against capacity is the one signal; the team sets the target.',
  assumptionChecklist: [
    "The act's audience skews the way the plan assumes",
    'The comparable acts describe one audience',
    'The show date does not share its audience with a rival show',
  ],
  planSections: [
    { key: 's1', title: 'Press and promoters', one: 'Press or promoter' },
    { key: 's2', title: 'Sponsors and partners', one: 'Sponsor or partner' },
    { key: 's3', title: 'Where the audience goes out', one: 'Venue' },
    { key: 's4', title: 'Cities', one: 'City' },
  ],
  toolAllowlist: [
    'searchEntity',
    'audienceBySegment',
    'resolveBundle',
    'rankPlaces',
    'lift',
    'partnerFit',
    'scoreRivals',
    'findTaste',
  ],
  consults: [],
  qloo: { titles: ['urn:entity:artist', 'urn:entity:movie'], ...sharedQlooCoverage },
  coverage: {
    tests: [
      "The act's audience by age and gender",
      'Which of your cities the audience is strongest in',
      'The venues and sponsors that audience uses, city by city',
      'How much of the audience a rival show on a nearby date shares',
    ],
    thin: [
      'Comedians and stage plays, which Qloo holds as people, films or cast albums',
      'Venues in Lagos and Accra for comedy, theatre and concert halls',
    ],
    notSupported: [
      'Ticket prices, venue capacity and event calendars',
      'Festivals, full tours, routing and booking a lineup',
    ],
  },
};
