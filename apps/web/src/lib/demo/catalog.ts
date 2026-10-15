import { type Category, type CategoryInfo, categoryInfoSchema } from '@oraqul/schema';
import { PACKS } from './packs';

/** Stand-in for `GET /categories/:id`. */
export function getCategory(id: Category): CategoryInfo {
  const pk = PACKS[id];
  return categoryInfoSchema.parse({
    id,
    name: pk.name,
    short: pk.short,
    blurb: pk.blurb,
    tools: pk.tools,
    coverage: { tests: pk.cov.tests, thin: pk.cov.thin, notSupported: pk.cov.none },
    quick: { date: pk.quick[0], results: pk.quick[1], partner: pk.quick[2] },
    scenarioExample: pk.scen[0]?.label ?? '',
    inputLabels: Object.fromEntries(pk.fields.map(([label, key]) => [key, label])),
    extraLabel: pk.q2.label,
    fallback: pk.fallback,
  });
}
