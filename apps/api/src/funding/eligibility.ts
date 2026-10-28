import type { Eligibility, FundCriterion, ProjectFacts } from '@oraqul/schema';

// Whether a fund's published criteria appear met, computed in code from what the page states and
// what the plan and the project say. It never says a team qualifies: it says which published
// criteria appear met and which cannot be compared. Any criterion that cannot be compared makes the
// verdict `check`, and a fund with no criteria at all is `check` too, never `eligible`.

export interface EligibilityFacts extends ProjectFacts {
  /** The plan's category, such as `film`. */
  category: string;
  /** The plan's territories, home first. */
  territories: string[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const words = (s: string) => ` ${norm(s)} `;

// What each category is called on a call for applications.
const CATEGORY_WORDS: Record<string, string[]> = {
  film: [
    'film',
    'films',
    'feature',
    'features',
    'cinema',
    'movie',
    'movies',
    'screen',
    'screenplay',
    'audiovisual',
    'series',
    'television',
    'tv',
    'documentary',
  ],
  music: ['music', 'album', 'albums', 'recording', 'musician', 'musicians', 'artist', 'artists'],
  books: [
    'book',
    'books',
    'literature',
    'literary',
    'publishing',
    'author',
    'authors',
    'novel',
    'novels',
  ],
  podcasts: ['podcast', 'podcasts', 'audio', 'radio'],
  games: ['game', 'games', 'gaming', 'videogame', 'videogames', 'interactive'],
  shows: [
    'live',
    'show',
    'shows',
    'theatre',
    'theater',
    'concert',
    'concerts',
    'performing',
    'comedy',
    'festival',
  ],
};

// What each stage is called on a call for applications.
const STAGE_WORDS: Record<string, string[]> = {
  idea: ['idea', 'concept', 'early', 'ideation'],
  development: [
    'development',
    'developing',
    'script',
    'scripting',
    'pre production',
    'preproduction',
    'packaging',
    'treatment',
  ],
  production: ['production', 'shooting', 'principal photography', 'filming'],
  post: ['post production', 'postproduction', 'post', 'editing', 'completion', 'finishing'],
  released: [
    'distribution',
    'release',
    'released',
    'marketing',
    'audience',
    'exhibition',
    'outreach',
    'launch',
    'sales',
  ],
};

const mentions = (text: string, list: string[]) =>
  list.some((w) => words(text).includes(` ${norm(w)} `));

function category(c: FundCriterion, facts: EligibilityFacts): 'met' | 'failed' | 'unknown' {
  const value = c.value ?? c.text;
  const mine = CATEGORY_WORDS[facts.category] ?? [facts.category];
  if (mentions(value, mine)) return 'met';
  // The criterion names another kind of work, so this plan is not the kind it is for.
  const other = Object.entries(CATEGORY_WORDS)
    .filter(([k]) => k !== facts.category)
    .some(([, list]) => mentions(value, list));
  return other ? 'failed' : 'unknown';
}

function stage(c: FundCriterion, facts: EligibilityFacts): 'met' | 'failed' | 'unknown' {
  if (!facts.stage) return 'unknown';
  const value = c.value ?? c.text;
  if (mentions(value, STAGE_WORDS[facts.stage] ?? [])) return 'met';
  const other = Object.entries(STAGE_WORDS)
    .filter(([k]) => k !== facts.stage)
    .some(([, list]) => mentions(value, list));
  return other ? 'failed' : 'unknown';
}

// A nationality or a place is never ruled out from a page's wording: "African", "Commonwealth" and
// "emerging markets" all contain Nigeria, and a wrong "not eligible" costs a team a real chance.
function nationality(c: FundCriterion, facts: EligibilityFacts): 'met' | 'unknown' {
  if (!facts.nationality) return 'unknown';
  return words(c.value ?? c.text).includes(` ${norm(facts.nationality)} `) ? 'met' : 'unknown';
}

function territory(c: FundCriterion, facts: EligibilityFacts): 'met' | 'unknown' {
  const value = words(c.value ?? c.text);
  return facts.territories.some((t) => value.includes(` ${norm(t)} `)) ? 'met' : 'unknown';
}

export function eligibilityOf(
  criteria: FundCriterion[],
  facts: EligibilityFacts,
  /** True when the page lists conditions beyond the ones captured, so none can be called complete. */
  otherConditions = false,
): Eligibility {
  const met: string[] = [];
  const unknown: string[] = [];
  const failed: string[] = [];
  for (const c of criteria) {
    const result =
      c.field === 'category'
        ? category(c, facts)
        : c.field === 'stage'
          ? stage(c, facts)
          : c.field === 'nationality'
            ? nationality(c, facts)
            : c.field === 'territory'
              ? territory(c, facts)
              : 'unknown';
    (result === 'met' ? met : result === 'failed' ? failed : unknown).push(c.text);
  }
  if (otherConditions) unknown.push('The page lists other conditions that were not compared.');
  if (criteria.length === 0) unknown.push('No published criteria were found on the page.');
  const verdict = failed.length > 0 ? 'not-eligible' : unknown.length > 0 ? 'check' : 'eligible';
  return { verdict, met, unknown, failed };
}
