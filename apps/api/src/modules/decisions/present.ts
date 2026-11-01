import type { Action, ActionKind, CrisisRoute, Pathway } from '@figcit/engine';
import { ENGINE_VERSION, type Card, type CardItem } from '@figcit/engine-v2';
import { toActionDto } from '../recommendation/card.js';
import type { CardDto, whySchema } from '../recommendation/recommendation.schemas.js';
import type { z } from 'zod';

type Why = z.infer<typeof whySchema>;

/** What the card needs besides the engine's output (E-53). */
export interface Presentation {
  /** The version's wording table (x-copy). */
  readonly copy: ReadonlyMap<string, string>;
  /** Light labels, icons and colours; still the app's existing content (T-25). */
  readonly lights: Readonly<Record<CardDto['light'], { label: string; icon: string; hex: string }>>;
  readonly state: CardDto['state'];
  readonly routes: readonly CrisisRoute[];
  /** The feelings the user picked, in their own chip words: "overwhelmed (strong)". */
  readonly said: readonly string[];
  readonly taskTitle: string | null;
  /** The version's label, shown as the "snapshot" in Why. */
  readonly version: string;
  /** Tab 7 patterns whose rules fired (from the trace). */
  readonly patterns: readonly number[];
  /** The task's timeline code (Tab 4), if there is a task. */
  readonly timeline: string | null;
  /** Pathways the user just declined: never promoted to the primary (Tab 7 non-negotiables). */
  readonly rejected: readonly string[];
}

export interface CardIds {
  readonly id: string;
  readonly checkInId: string;
  readonly createdAt: Date;
  readonly taskId: string | null;
  readonly origin: 'online' | 'offline';
}

const ACTION_KIND: Readonly<Record<string, ActionKind>> = {
  get_support_now: 'support',
  try_anyway: 'try_anyway',
  skip_to_task: 'skip_to_task',
  save_for_later: 'save_for_later',
  open_home: 'open_home',
  check_in: 'check_in_again',
};

const fill = (text: string, values: Readonly<Record<string, string>>): string =>
  text.replace(/\{(\w+)\}/g, (_m, k: string) => values[k] ?? '');
const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);
const list = (items: readonly string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;

/** The button label: the pattern's wording, else the tool's or the action's own name. */
function labelOf(item: CardItem, copy: Presentation['copy']): string {
  const own = item.copy ? copy.get(item.copy) : undefined;
  if (own) return own;
  if (item.tool) return copy.get(`tool.${item.tool}`) ?? item.tool;
  if ('action' in item.target)
    return copy.get(`action.${item.target.action}`) ?? item.target.action;
  return item.pathway ?? '';
}

/** A v2 card item as the app's action (its kinds and links, recommendation/card.ts). */
function toAction(item: CardItem, p: Presentation, minutes: number | null): Action {
  const label = fill(labelOf(item, p.copy), { task: p.taskTitle ?? 'your task' });
  if ('action' in item.target) {
    if (item.target.action === 'start_small')
      return { kind: 'pathway', label, pathway: 'execute', toolId: 'smallest_step' };
    return { kind: ACTION_KIND[item.target.action] ?? 'open_home', label };
  }
  if (item.tool === 'own_practice') return { kind: 'own_practice', label };
  if (item.tool === 'quick_message' && item.copy?.endsWith('quiet_message'))
    return { kind: 'quiet_message', label };
  return {
    kind: 'pathway',
    label,
    pathway: (item.pathway ?? 'regulate') as Pathway,
    ...(item.tool ? { toolId: item.tool } : {}),
    ...(item.advanced ? { advanced: true } : {}),
    ...(minutes !== null && (item.pathway === 'regulate' || item.pathway === 'meditate')
      ? { minutes }
      : {}),
  };
}

/** The headline: the primary's own `.title`, else its pattern's, else the default. */
function titleOf(primary: CardItem | null, p: Presentation): string {
  const key = primary?.copy ?? '';
  const pattern = /^card\.p(\d+)\./.exec(key);
  const text =
    p.copy.get(`${key}.title`) ??
    (pattern ? p.copy.get(`card.p${pattern[1] ?? ''}.title`) : undefined) ??
    p.copy.get('card.title.default') ??
    '';
  return fill(text, { task: p.taskTitle ?? 'your task' });
}

/** "Because you said X, FigCit suggests Y." (Tab 7 non-negotiables), then the next step and prompts. */
function rationaleOf(
  primary: Action,
  queued: Action | null,
  prompts: readonly string[],
  p: Presentation,
): string {
  const suggestion = primary.label;
  const head =
    p.said.length > 0
      ? fill(p.copy.get('card.because') ?? '', { said: `you feel ${list(p.said)}`, suggestion })
      : fill(p.copy.get('card.because.state') ?? '', { suggestion });
  const next = queued
    ? ` ${fill(p.copy.get('card.after') ?? '', { next: lower(queued.label) })}`
    : '';
  const extra = prompts.map((key) => p.copy.get(key)).filter((t): t is string => Boolean(t));
  return [head + next, ...extra].join(' ');
}

/** The card's buttons: the primary, two options (always-visible actions first), the next step. */
function actionsOf(
  v2: Card,
  p: Presentation,
): { lead: CardItem | null; primary: Action; alternatives: Action[]; queued: Action | null } {
  const visible = v2.visible.filter(
    (i) => !('action' in i.target && i.target.action === 'get_support_now'),
  );
  const options = [...visible, ...v2.alternatives];
  // With no primary, the first option the user hasn't just declined leads (the engine forbids a
  // declined pathway as the primary; promoting one would undo that).
  const promotable = options.findIndex((i) => !p.rejected.includes(i.pathway ?? ''));
  const lead = v2.primary ?? (promotable >= 0 ? (options.splice(promotable, 1)[0] ?? null) : null);
  const primary: Action = lead
    ? toAction(lead, p, v2.minutesCap)
    : { kind: 'open_home', label: p.copy.get('action.open_home') ?? '' };
  const reminder: Action[] =
    v2.reminder && options.length < 2
      ? [
          {
            kind: 'remind_later',
            label: (v2.reminder.copy && p.copy.get(v2.reminder.copy)) ?? '',
            minutes: v2.reminder.minutes,
          },
        ]
      : [];
  const alternatives = [...options.map((i) => toAction(i, p, v2.minutesCap)), ...reminder].slice(
    0,
    2,
  );
  const queued = v2.queued[0] ? toAction(v2.queued[0], p, v2.minutesCap) : null;
  return { lead, primary, alternatives, queued };
}

/** "What influenced this" (S35): the state, the sentence and the drivers; versions for staff. */
function whyOf(v2: Card, p: Presentation, rationale: string): Why {
  return {
    reasons: [
      ...(p.state.confirmed
        ? [{ code: 'state', text: `You picked ${p.state.name}: ${p.state.meaning}` }]
        : []),
      { code: 'because', text: rationale },
      ...(v2.drivers.length > 0
        ? [
            {
              code: 'drivers',
              text: `What usually gets you going: ${v2.drivers.map((d) => d.code).join(', ')}`,
            },
          ]
        : []),
    ],
    modifiers: [],
    gates: [],
    versions: { engine: ENGINE_VERSION, snapshot: p.version },
  };
}

/**
 * The app's card (its contract, `CardDto`) from a v2 card (M8, E-53). The always-visible buttons
 * ("I'll try the task anyway", "Skip to task") take the alternative places first, as the app's card
 * holds two; a card with no primary offers its first option as the primary, or Home. The support
 * screen (pattern 28) is the support button and the crisis routes only.
 */
export function present(v2: Card, p: Presentation, ids: CardIds): { card: CardDto; why: Why } {
  const ctx = { recommendationId: ids.id, taskId: ids.taskId };
  const dto = (a: Action) => toActionDto(a, ctx);
  const support = v2.kind === 'support_screen';
  const light = (v2.light ?? 'red') as CardDto['light'];
  const shown = p.lights[light];
  const base = {
    ...ids,
    createdAt: ids.createdAt.toISOString(),
    light,
    lightLabel: shown.label,
    lightHex: shown.hex,
    lightIcon: shown.icon,
    state: p.state,
    supportVisible: v2.supportVisible,
    crisisRoutes: v2.supportVisible ? [...p.routes] : [],
    patterns: [...p.patterns],
    taskId: ids.taskId,
    origin: ids.origin,
  };
  if (support) {
    const title = p.copy.get('card.support.title') ?? '';
    const card: CardDto = {
      ...base,
      title,
      rationale: title,
      primary: dto({ kind: 'support', label: p.copy.get('card.support.cta') ?? '' }),
      alternatives: [],
      queuedStep: null,
      notNow: false,
      safetyTriggered: true,
      timeline: null,
    };
    return { card, why: whyOf(v2, p, title) };
  }
  const a = actionsOf(v2, p);
  const rationale = rationaleOf(a.primary, a.queued, v2.prompts, p);
  const card: CardDto = {
    ...base,
    title: titleOf(a.lead, p),
    rationale,
    primary: dto(a.primary),
    alternatives: a.alternatives.map(dto),
    queuedStep: a.queued ? dto(a.queued) : null,
    notNow: true,
    safetyTriggered: false,
    timeline: p.timeline && v2.stepCap !== null ? { code: p.timeline, stepCap: v2.stepCap } : null,
  };
  return { card, why: whyOf(v2, p, rationale) };
}
