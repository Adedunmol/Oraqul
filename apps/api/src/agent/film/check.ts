import { filmPlan } from '@oraqul/packs';
import type { LaunchSectionKey } from '@oraqul/schema';
import {
  type CheckRules,
  checkLine as checkLaunchLine,
  checkSections as checkLaunchSections,
  citeWhatIsNamed as citeLaunchWhatIsNamed,
  type CheckContext as LaunchCheckContext,
} from '../launch/check.js';
import type { WrittenLine, WrittenSection } from '../launch/writer.js';

export const FILM_RULES: CheckRules = {
  titles: filmPlan.SECTION_TITLES,
  tasteClaim: filmPlan.TASTE_CLAIM,
  tagOnly: ['themes'],
};

export type CheckContext = Omit<LaunchCheckContext, 'rules'>;

const withRules = (ctx: CheckContext): LaunchCheckContext => ({ ...ctx, rules: FILM_RULES });

export const citeWhatIsNamed = (written: WrittenLine, ctx: CheckContext) =>
  citeLaunchWhatIsNamed(written, withRules(ctx));

export const checkLine = (section: LaunchSectionKey, line: WrittenLine, ctx: CheckContext) =>
  checkLaunchLine(section, line, withRules(ctx));

export const checkSections = (written: WrittenSection[], ctx: CheckContext) =>
  checkLaunchSections(written, withRules(ctx));
