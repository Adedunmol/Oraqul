import type { ToolContext } from '@oraqul/engine';
import type {
  Category,
  CompUsed,
  LaunchModuleKey,
  LaunchSection,
  LaunchSectionKey,
  QlooEntityType,
  ThreadEvent,
} from '@oraqul/schema';
import type { DraftItem } from './audit-verdicts.js';
import type { CheckRules } from './check.js';
import type { DecisionWords } from './decisions.js';
import type { GroundDeps, Grounded, GroundInput } from './findings.js';
import type { Change } from './follow-up.js';
import type { QueryPlanCore, QueryPlanner } from './planner.js';
import type { LaunchRead } from './read-core.js';
import type { Researcher } from './research.js';
import type { PlanWriter, WriteInput, WrittenLine } from './writer.js';

/** The kinds of work a comp can be: what a launch is described by. */
export type AnchorType =
  | 'urn:entity:movie'
  | 'urn:entity:tv_show'
  | 'urn:entity:artist'
  | 'urn:entity:videogame'
  | 'urn:entity:podcast'
  | 'urn:entity:book';

/** The modules a plan carries, and the ones the brief rules out with why, for the Gaps section. */
export interface ModulePick {
  modules: LaunchModuleKey[];
  ruledOut: { key: LaunchModuleKey; why: string }[];
}

/**
 * Everything the shared launch pipeline asks of a category (spec §3.2): one agent per category is
 * this configuration on the same runtime. The shared code never names a film or an artist.
 */
export interface LaunchConfig<
  R extends LaunchRead = LaunchRead,
  P extends QueryPlanCore = QueryPlanCore,
> {
  category: Category;
  /** Entity types a comp is looked up in. */
  anchorTypes: readonly AnchorType[];
  /** Entity types a rival release is looked up in. */
  rivalTypes: readonly QlooEntityType[];
  /** Where tags of a genre live in Qloo, for the genre fallback when no comp is found by name. */
  genreTagPrefix: string;
  /** Finding queries that rank artists, which a partner brief and an audit can place. */
  artistQueries: readonly string[];

  /** The words that name the work, for messages the shared code writes. */
  words: {
    /** What a person names as comps: "films or series". */
    comps: string;
    /** One comp: "title" or "artist". */
    entity: string;
    /** A rival release in a date check, as a person would write it. */
    rivalExample: string;
    /** An example plan to paste, for the audit's question. */
    planExample: string;
    /** What a pitch for an artist asks for. */
    artistPitch: string;
    /** What the audience does with comps, for the message when none is found. Defaults to "watches". */
    compsVerb?: string;
  };

  /**
   * The work the launch is about, when Qloo may already know it (an artist). It is looked up
   * with the comps and used as an anchor, but it is never listed as a comp. Not found is normal
   * before a debut, and the plan then rests on the comps.
   */
  lead?(read: R): string | null;

  /**
   * Names the person tied to the launch besides the comps (an artist featured on the release).
   * They are looked up and used as audience anchors like the person's own comps, and count toward
   * the three a plan wants, but never push out the comps that were named.
   */
  teamAnchors?(read: R): string[];

  /**
   * The one question a build may ask: there is nothing to plan from without these. `strict` asks
   * again when the answer still leaves something missing, instead of planning from nothing.
   */
  minimum: { id: string; example: string; strict?: boolean; missing(read: R): string[] };
  pickModules(read: R): ModulePick;

  rules: CheckRules;
  decisions: DecisionWords;
  /** The names the brief gives, for the line check: places, cast, partners and so on. */
  briefNames: {
    build(read: R): string[];
    answer(read: R): string[];
  };
  /** The sections code writes: the budget split and what would sharpen the plan. */
  codeSections: {
    budget(read: R): LaunchSection;
    gaps(read: R, comps: { used: CompUsed[] }): LaunchSection;
    /** A calendar code builds from the launch kind and `today`, so no past date is advised. */
    timeline?(read: R, today: string): LaunchSection;
  };
  /** The part of a what-if only this category reads, such as the collabs a person adds. */
  applyChange?(read: R, change: Change): R;
  templateSection(key: LaunchSectionKey, input: WriteInput<R>): WrittenLine[];
  /** A reading with nothing in it, for an answer about a plan saved before readings. */
  emptyRead: R;

  /** Stage 1: the audience, the cities and the category's own queries. */
  ground(deps: GroundDeps, input: GroundInput<R, P>): Promise<Grounded>;

  /** How many claims in a plan can be tested. With none, an audit asks for the plan. */
  claims(read: R): number;
  /** Beliefs beyond age, gender, place, comps, partners and the window, tested from findings. */
  beliefs(read: R, text: string, grounded: Grounded): DraftItem[];
}

/** What a shared run needs: the category, its readers and writers, and the tools. */
export interface LaunchDeps<
  R extends LaunchRead = LaunchRead,
  P extends QueryPlanCore = QueryPlanCore,
> {
  config: LaunchConfig<R, P>;
  /** Reads the brief and keeps only what the person said. */
  read(input: { title: string; text: string }): Promise<{ read: R; tokens: number }>;
  /** Looks up release timing and market facts on the web, when search is configured. */
  research: Researcher<R>;
  queries: QueryPlanner<R, P>;
  writer: PlanWriter<R>;
  tools: ToolContext;
  emit(event: ThreadEvent): void;
}
