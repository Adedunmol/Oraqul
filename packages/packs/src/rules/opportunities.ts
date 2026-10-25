import { teamRule } from './shared';

// What a team does with an opportunity the evidence points to. The wording is launch craft that
// claims nothing about taste, so every line built from it is a playbook line. `{name}`, `{city}` and
// `{weakest}` are filled by code; `{signal}` is the plan's one signal.

export const OPPORTUNITY_VERSION = 'opportunities@2026-10-25.1';

export type OpportunityKind = 'market' | 'area';

export interface OpportunityRule {
  /** What the evidence does not show, as an action. */
  limit: string;
  /** The smallest thing worth trying first. */
  test: string;
  /** What to read afterwards. */
  measure: string;
}

const MARKET = teamRule<OpportunityRule>('opportunities.market', {
  limit:
    'The audience data says people like this are there. It does not say the market will sell, so check how you would reach them in {name} before you move any of your plan.',
  test: 'Run one small test in {name}: the creative you already have, on your lead channel, with a fixed budget, before you change anything else.',
  measure: 'Judge it on {signal} in {name}, against {weakest}.',
});

const AREA = teamRule<OpportunityRule>('opportunities.area', {
  limit:
    'This is a lead from a few points near the centre of {city}, not a measured neighbourhood. Walk it or ask someone local before you book anything.',
  test: 'Put one small activation in {name}, such as a screening, a signing, a listening event or flyers with a local venue, and note who turns up.',
  measure: 'Judge it on {signal} from {name}, against {city} as a whole.',
});

export const OPPORTUNITY_RULES = {
  version: OPPORTUNITY_VERSION,
  kinds: { market: MARKET, area: AREA } satisfies Record<OpportunityKind, unknown>,
};
