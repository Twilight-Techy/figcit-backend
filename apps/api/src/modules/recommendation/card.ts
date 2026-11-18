import type {
  Action,
  ActionKind,
  CrisisRoute,
  EngineResult,
  Pathway,
  Snapshot,
} from '@figcit/engine';
import type { ActionDto, CardDto } from './recommendation.schemas.js';

type Ctx = { readonly recommendationId: string; readonly taskId: string | null };

function q(params: Record<string, string | undefined>): string {
  const s = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined),
  ).toString();
  return s ? `?${s}` : '';
}

const taskHref = (ctx: Ctx, tool: string | undefined): string =>
  ctx.taskId
    ? `/tasks/detail/${q({ id: ctx.taskId, tool, rec: ctx.recommendationId })}`
    : `/tasks/${q({ tool, rec: ctx.recommendationId })}`;

/** Where each pathway's tools live in the app (design/FLOWS.md). */
const PATHWAY_HREF: Readonly<Record<Pathway, (a: Action, ctx: Ctx) => string>> = {
  regulate: (a, c) =>
    `/regulate/session/${q({ tool: a.toolId, rec: c.recommendationId, min: a.minutes?.toString() })}`,
  dump: (a, c) => `/dump/${q({ tool: a.toolId, rec: c.recommendationId })}`,
  express: (a, c) => `/express/workspace/${q({ tool: a.toolId, rec: c.recommendationId })}`,
  execute: (a, c) => taskHref(c, a.toolId),
  adapt: (a, c) => `/adapt/${q({ rec: c.recommendationId, tool: a.toolId })}`,
  reflect: (a, c) => `/reflect/${q({ tool: a.toolId, rec: c.recommendationId })}`,
  connect: (a, c) => `/connect/${q({ tool: a.toolId, rec: c.recommendationId })}`,
  meditate: (a, c) =>
    `/meditate/session/${q({ tool: a.toolId, rec: c.recommendationId, min: a.minutes?.toString() })}`,
};

const ACTION_HREF: Readonly<
  Record<Exclude<ActionKind, 'pathway'>, (a: Action, ctx: Ctx) => string>
> = {
  support: () => '/help/',
  own_practice: (a, c) =>
    `/meditate/session/${q({ practice: a.practiceId, rec: c.recommendationId })}`,
  open_home: () => '/home/',
  check_in_again: (a) => (a.label.toLowerCase().includes('body') ? '/check/not-sure/' : '/check/'),
  skip_to_task: (_a, c) => taskHref(c, 'start_task'),
  try_anyway: (_a, c) => taskHref(c, 'start_task'),
  quiet_message: (_a, c) =>
    `/connect/${q({ tool: 'quick_message', template: 'need_quiet', rec: c.recommendationId })}`,
  save_for_later: (_a, c) => `/reflect/${q({ later: '1', rec: c.recommendationId })}`,
  remind_later: (a, c) => `/reminders/${q({ in: a.minutes?.toString(), rec: c.recommendationId })}`,
};

/** Where the app goes for each action (PWA routes, design/FLOWS.md). */
export function hrefFor(action: Action, ctx: Ctx): string {
  if (action.kind === 'pathway')
    return action.pathway ? PATHWAY_HREF[action.pathway](action, ctx) : '/home/';
  return ACTION_HREF[action.kind](action, ctx);
}

export function toActionDto(action: Action, ctx: Ctx): ActionDto {
  return {
    kind: action.kind,
    label: action.label,
    ...(action.pathway ? { pathway: action.pathway } : {}),
    ...(action.toolId ? { toolId: action.toolId } : {}),
    ...(action.advanced ? { advanced: true } : {}),
    ...(action.minutes !== undefined ? { minutes: action.minutes } : {}),
    ...(action.practiceId ? { practiceId: action.practiceId } : {}),
    href: hrefFor(action, ctx),
  };
}

export interface CardContext {
  readonly id: string;
  readonly checkInId: string;
  readonly createdAt: Date;
  readonly taskId: string | null;
  readonly origin: 'online' | 'offline';
  readonly routes: readonly CrisisRoute[];
}

export function toCard(result: EngineResult, snapshot: Snapshot, ctx: CardContext): CardDto {
  const light = snapshot.lights[result.light];
  const actionCtx = { recommendationId: ctx.id, taskId: ctx.taskId };
  return {
    id: ctx.id,
    checkInId: ctx.checkInId,
    createdAt: ctx.createdAt.toISOString(),
    light: result.light,
    lightLabel: light.label,
    lightHex: light.hex,
    lightIcon: light.icon,
    state: result.state,
    title: result.title,
    rationale: result.rationale.text,
    primary: toActionDto(result.primary, actionCtx),
    alternatives: result.alternatives.map((a) => toActionDto(a, actionCtx)),
    queuedStep: result.queuedStep ? toActionDto(result.queuedStep, actionCtx) : null,
    supportVisible: result.supportVisible,
    notNow: result.notNow,
    safetyTriggered: result.safety.triggered,
    crisisRoutes: result.supportVisible || result.safety.triggered ? [...ctx.routes] : [],
    patterns: [...result.patterns],
    timeline: result.timeline ?? null,
    taskId: ctx.taskId,
    origin: ctx.origin,
  };
}
