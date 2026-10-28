import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const podcasts: CategoryPack = {
  category: 'podcasts',
  title: 'Podcasts',
  blurb: 'Shows, guests and sponsors, planned around the listener.',
  covers:
    'podcast shows, new seasons, episodes, guests, cross promotion, sponsorships, video podcasts and live shows',
  systemPrompt:
    'You are the podcasts agent. Read the lead as a show, and the launch as a new show or a new season, in audio, video or both. Treat the show as the strongest signal when Qloo knows it, and its comparable shows as the comps when it does not. The launch kind and format shape the calendar: say which you assumed when the brief does not say. Call the people who hear the show listeners. A topic is yours only when the topic map says your listeners lean to it more than the listeners of the rival shows.',
  assumptionChecklist: [
    "The show's audience skews the way the plan assumes",
    'The comparable shows describe one audience',
    'The topics you want to own are ones your listeners lean to more than rival listeners',
  ],
  planSections: [
    { key: 's1', title: 'Cross promotion shows', one: 'Show' },
    { key: 's2', title: 'Sponsors', one: 'Sponsor' },
    { key: 's3', title: 'Guests', one: 'Guest' },
    { key: 's4', title: 'Markets', one: 'Market' },
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
    'themeTags',
    'topicMap',
  ],
  consults: [],
  qloo: { titles: ['urn:entity:podcast'], ...sharedQlooCoverage },
  coverage: {
    tests: [
      "The show's audience by age and gender",
      'Which of your markets the audience is strongest in',
      'Which topics your listeners lean to that rival shows do not own',
      'Which shows that audience already hears, for cross promotion',
      'Which brands that audience uses, for sponsors',
    ],
    thin: [
      'New shows, planned from comparable shows and their listeners',
      'Guests and hosts, matched to the listener once they are named',
    ],
    notSupported: [
      'Downloads, chart positions, ratings and ad rates',
      'Editorial placement and festival dates, which change every year',
    ],
  },
};
