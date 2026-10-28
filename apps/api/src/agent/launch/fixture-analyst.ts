import type { Analysis, Analyst } from './analyse.js';

/**
 * Answers every request with one recorded reading, as a model analyst would. Golden runs use it to
 * test the path where comps are chosen from a description without calling a model.
 */
export class FixtureAnalyst implements Analyst {
  constructor(private readonly analysis: Analysis) {}

  async analyse() {
    return { analysis: this.analysis, tokens: 0 };
  }
}

/** A recorded reading that chose these comps for these readers, as a model analyst would. */
export function fixtureAnalysis(comps: string[], who: string): Analysis {
  return {
    asked: 'A launch plan.',
    goals: [],
    constraints: [],
    inferred: [],
    criteria: [
      { text: 'Says which city to open in and why', evidence: true },
      { text: 'Names the first partner to approach', evidence: true },
    ],
    readers: {
      who,
      ages: [],
      consumes: 'the comparable titles',
      why: 'Read from the description.',
    },
    comps: comps.map((name) => ({ name, why: 'A comparable title for those readers.' })),
  };
}
