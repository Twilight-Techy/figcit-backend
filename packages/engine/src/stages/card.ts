// Stages 9–12: context tool filter, entitlement filter (ENT-1–ENT-3), personalisation re-rank and
// the card itself (one primary, up to two alternatives, rationale, queued step).
import type { Facts, Plan, StepSpec } from '../patterns/index.js';
import type { Action, ActionKind, GateResult, Light, SnapshotTool } from '../types.js';
import { intensityBand } from './experience.js';

const DEFAULT_LABELS: Readonly<Record<ActionKind, string>> = {
  pathway: '',
  support: 'Get support now',
  skip_to_task: 'Skip to task',
  try_anyway: "I'll try the task anyway",
  save_for_later: 'Save for later',
  remind_later: 'Remind me later',
  check_in_again: 'Check in again',
  open_home: 'Open Home',
  own_practice: 'My practice',
  quiet_message: "Send my 'I need quiet' message",
};

const PRIVATE_ONLY_FORMATS = new Set(['eyes_closed', 'body_scan', 'spoken', 'walking']);

/** Is this tool usable here and now? (Tab 3b exclusions, shutdown = no words, MD-4, opt-ins.) */
export function usable(f: Facts, tool: SnapshotTool): boolean {
  if (f.ctx.excluded.has(tool.id)) return false;
  const shutdown = f.exp.families.has('shutdown') || f.exp.flags.has('shutdown');
  if (shutdown && tool.verbal && tool.pathway !== 'express') return false;
  if (tool.id === 'body_scan' && f.signals.bodyScanOptIn !== true) return false;
  if (tool.pathway === 'meditate' && !f.ctx.privateSetting) {
    if (tool.practiceFormat && PRIVATE_ONLY_FORMATS.has(tool.practiceFormat)) return false;
    if (
      tool.minutes > f.cs.source.thresholds.publicMeditateMaxMinutes &&
      tool.id !== 'own_practice'
    )
      return false;
  }
  return true;
}

interface Chosen {
  readonly tool: SnapshotTool;
  /** The best-fit Advanced tool the plan wanted but couldn't use (offered as one labelled alternative). */
  readonly upgradeCandidate: SnapshotTool | undefined;
}

function strainedLight(light: Light): boolean {
  return light === 'amber' || light === 'red';
}

/** Picks the first usable tool, honouring the plan, the Amber/Red safety floor and rejections. */
export function chooseTool(
  f: Facts,
  step: Extract<StepSpec, { type: 'tool' }>,
  light: Light,
): Chosen | undefined {
  const rejected = new Set(f.signals.rejectedToolIds ?? []);
  const pathwayTools = f.cs.toolsByPathway.get(step.pathway) ?? [];
  const wanted = step.tools
    .map((id) => f.cs.toolById.get(id))
    .filter((t): t is SnapshotTool => t !== undefined);
  const floorOnly = strainedLight(light);
  // Preference order: the plan's list, then the rest of the pathway (floor tools first).
  const ordered = [
    ...wanted,
    ...pathwayTools
      .filter((t) => !step.tools.includes(t.id))
      .sort((a, b) => Number(b.safetyFloor) - Number(a.safetyFloor)),
  ];
  let upgradeCandidate: SnapshotTool | undefined;
  for (const pass of [true, false]) {
    for (const tool of ordered) {
      if (!usable(f, tool) || (pass && rejected.has(tool.id))) continue;
      const entitled = tool.tier === 'free' || f.signals.plan === 'plus';
      if (floorOnly && !tool.safetyFloor) continue;
      if (!entitled) {
        upgradeCandidate ??= tool;
        continue;
      }
      return { tool, upgradeCandidate };
    }
  }
  return undefined;
}

function upsellAllowed(f: Facts, light: Light): boolean {
  // ENT-3: no Advanced tiles under strain, after a safety event or during a session.
  if (strainedLight(light) || f.signals.plan === 'plus') return false;
  if (f.exp.peakNegative >= f.cs.source.thresholds.high) return false;
  return !(
    f.signals.safetyEventRecently === true ||
    f.signals.inSession === true ||
    f.signals.dismissedAdvanced === true ||
    f.safety
  );
}

function toAction(
  f: Facts,
  step: StepSpec,
  light: Light,
  notes: string[],
): { action: Action; upgrade?: SnapshotTool } | undefined {
  if (step.type === 'action') {
    const base: Action = { kind: step.kind, label: step.label ?? DEFAULT_LABELS[step.kind] };
    return {
      action: {
        ...base,
        ...(step.minutes !== undefined ? { minutes: step.minutes } : {}),
        ...(step.practiceId ? { practiceId: step.practiceId } : {}),
      },
    };
  }
  const chosen = chooseTool(f, step, light);
  if (!chosen) {
    notes.push(`no usable ${step.pathway} tool here`);
    return undefined;
  }
  const minutes = step.minutes ?? chosen.tool.minutes;
  const action: Action = {
    kind: 'pathway',
    pathway: step.pathway,
    toolId: chosen.tool.id,
    label: step.label ?? chosen.tool.name,
    minutes,
  };
  if (chosen.tool.id !== step.tools[0])
    notes.push(`${step.pathway}: ${chosen.tool.id} instead of ${step.tools[0] ?? '?'}`);
  return chosen.upgradeCandidate ? { action, upgrade: chosen.upgradeCandidate } : { action };
}

const sameAction = (a: Action, b: Action): boolean =>
  a.kind === b.kind &&
  a.toolId === b.toolId &&
  a.practiceId === b.practiceId &&
  (a.kind === 'pathway' || a.label === b.label);

export interface Card {
  readonly primary: Action;
  readonly alternatives: readonly Action[];
  readonly queued: Action | undefined;
  readonly gates: readonly GateResult[];
}

const FALLBACK_STEP: StepSpec = {
  type: 'tool',
  pathway: 'regulate',
  tools: ['breathe', 'ground', 'rest'],
};

function resolvePrimary(
  f: Facts,
  plan: Plan,
  light: Light,
  notes: string[],
): { action: Action; upgrade?: SnapshotTool } {
  const result =
    toAction(f, plan.primary, light, notes) ?? toAction(f, FALLBACK_STEP, light, notes);
  if (!result) throw new Error('No usable primary tool: snapshot violates ENT-1');
  if (!plan.button || result.action.kind !== 'pathway') return result;
  return { ...result, action: { ...result.action, label: plan.button } };
}

/** Alternatives in plan order, minus duplicates and the support button (shown on its own). */
interface Ctx {
  readonly light: Light;
  readonly notes: string[];
}

function resolveAlternatives(
  f: Facts,
  plan: Plan,
  primary: Action,
  { light, notes }: Ctx,
): { actions: Action[]; upgrade: SnapshotTool | undefined } {
  const actions: Action[] = [];
  let upgrade: SnapshotTool | undefined;
  for (const step of plan.alternatives) {
    if (step.type === 'action' && step.kind === 'support' && plan.supportVisible === true) continue;
    const result = toAction(f, step, light, notes);
    if (!result) continue;
    upgrade ??= result.upgrade;
    const duplicate =
      sameAction(result.action, primary) || actions.some((a) => sameAction(a, result.action));
    if (!duplicate) actions.push(result.action);
  }
  return { actions, upgrade };
}

const advancedAction = (tool: SnapshotTool): Action => ({
  kind: 'pathway',
  pathway: tool.pathway,
  toolId: tool.id,
  label: tool.name,
  advanced: true,
  minutes: tool.minutes,
});

export function buildCard(f: Facts, plan: Plan, light: Light, notes: string[]): Card {
  const gates: GateResult[] = [];
  const primary = resolvePrimary(f, plan, light, notes);
  const alts = resolveAlternatives(f, plan, primary.action, { light, notes });
  rerank(f, alts.actions);
  const upgrade = primary.upgrade ?? alts.upgrade;
  let kept = alts.actions.slice(0, 2);
  if (upgrade && upsellAllowed(f, light)) {
    // ENT-3: at most one labelled Advanced alternative, never the primary.
    kept = [...alts.actions.slice(0, 1), advancedAction(upgrade)];
    gates.push({
      rule: 'ENT-3',
      effect: 'allowed',
      detail: `one Advanced alternative: ${upgrade.id}`,
    });
  } else if (upgrade) {
    gates.push({ rule: 'ENT-3', effect: 'blocked', detail: `Advanced ${upgrade.id} not shown` });
  }
  if (primary.upgrade)
    gates.push({
      rule: 'ENT-1',
      effect: 'limited',
      detail: `primary is the best free tool (${primary.action.toolId ?? primary.action.kind})`,
    });
  const queued = plan.queued ? toAction(f, plan.queued, light, notes)?.action : undefined;
  return { primary: primary.action, alternatives: kept, queued, gates };
}

/** Stage 11: personalisation re-orders allowed alternatives only (FR-M13-04); never the primary. */
function rerank(f: Facts, alternatives: Action[]): void {
  const scores = f.signals.toolScores;
  // Stage 11 is opt-in (consent purpose `personalisation`); the caller sends scores only once
  // there are enough validated outcomes.
  if (!scores || f.signals.personalisation !== true) return;
  // Stable sort by score, O(a log a) for a ≤ 4.
  alternatives.sort((a, b) => (scores[b.toolId ?? ''] ?? 0) - (scores[a.toolId ?? ''] ?? 0));
}

export function rationale(
  f: Facts,
  plan: Plan,
  suggestion: string,
  queued: Action | undefined,
): string {
  const t = f.cs.source.thresholds;
  const because = f.state.cell
    ? f.state.cell.because
    : "not sure how you're feeling, which is okay";
  let feeling = '';
  let top = -1;
  for (const [code, intensity] of f.exp.families) {
    const family = f.cs.familyByCode.get(code);
    if (!family) continue;
    const weight = intensity + (family.valence === 'negative' ? 20 : 0);
    if (weight > top) {
      top = weight;
      feeling = family.feeling.replace(
        '{intensity}',
        intensityBand(intensity, t.high, t.veryHigh, t.moderate).replace('_', ' '),
      );
    }
  }
  const head = `Because you're ${because}${feeling ? ` and ${feeling}` : ''}, NUCCESS suggests ${suggestion}.`;
  const next = queued
    ? ` After that: ${queued.label.charAt(0).toLowerCase()}${queued.label.slice(1)}.`
    : '';
  const pattern = plan.patterns[0] ?? 0;
  const nothingForced = pattern === 1 || pattern === 30 ? ' Nothing is being asked of you.' : '';
  return `${head}${next}${nothingForced}`;
}
