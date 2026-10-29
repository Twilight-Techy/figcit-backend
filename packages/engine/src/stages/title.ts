// Stage 12 title: the pattern's words, kept true to the action actually shown (Tab 0 wording).
import type { Facts, Plan } from '../patterns/index.js';
import type { Light } from '../types.js';
import type { Card } from './card.js';

const MOVEMENT = new Set(['move', 'movement_plus', 'walking_practice', 'step_out']);
/** Pattern 12's "[environment/format/pace]" slot, filled from the Adapt tool chosen. */
const ADAPT_SLOT: Readonly<Record<string, string>> = {
  adapt_environment: 'environment',
  adapt_format: 'format',
  adapt_pace: 'pace',
};
const ADAPT_GENERIC = 'Would a different way of doing this make it easier?';
const REDUCE = "Let's reduce the load first";
const CARE = "Let's take care of you first";

interface TitleCtx {
  readonly f: Facts;
  readonly plan: Plan;
  readonly primary: Card['primary'];
  readonly light: Light;
}

/** Stage 9 can swap the planned tool for a discreet one; the title follows the tool shown. */
function toolTitle(title: string, primary: Card['primary']): string | undefined {
  const slot = ADAPT_SLOT[primary.toolId ?? ''];
  if (slot && title === ADAPT_GENERIC) return `Would a different ${slot} make this easier?`;
  if (!/\bmove\b/i.test(title) || MOVEMENT.has(primary.toolId ?? '')) return undefined;
  return title.includes('before') || title.includes('first')
    ? 'Want a 2-minute reset before we start?'
    : 'Want a quiet 2-minute reset?';
}

/**
 * Pattern 6 leading with a brain dump says "get it out of your head" (E1M1.4, E2M1.3, E4M2.5);
 * pattern 5 with a dump keeps "reduce the load" (E1M2.5); Red at low energy hears "take care of
 * you" (E1M1.2, E2M1.6) while high-energy Red keeps "reduce the load" (E4M2.4).
 */
function loadTitle(title: string, { f, plan, primary, light }: TitleCtx): string {
  const dump = primary.pathway === 'dump';
  if (plan.patterns[0] === 6 && dump) return "Let's get it out of your head first";
  if (dump && title === CARE) return REDUCE;
  const lowEnergy = (f.state.cell?.energy ?? 1) <= 2;
  return title === REDUCE && !dump && light === 'red' && lowEnergy ? CARE : title;
}

export function titleFor(f: Facts, plan: Plan, card: Card, light: Light): string {
  const pattern = f.cs.patternById.get(plan.patterns[0] ?? 0);
  const planned = plan.title ?? pattern?.title ?? '';
  const ctx = { f, plan, primary: card.primary, light };
  return (toolTitle(planned, card.primary) ?? loadTitle(planned, ctx))
    .replace('[task]', f.demand.title ? `“${f.demand.title}”` : 'your task')
    .replace('[practice]', card.primary.label.toLowerCase());
}
