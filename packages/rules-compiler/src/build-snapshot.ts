import { createHash } from 'node:crypto';
import type { Light, Snapshot, SnapshotTimeline, TimelineCode } from '@figcit/engine';
import { BODY_REGIONS, EMOTIONS, FAMILIES, SENSATIONS } from './catalogue/experience.js';
import { ENVIRONMENTS, SENSITIVITY_FLAGS, SOCIALS, SUPPORTS, TIMES } from './catalogue/context.js';
import { TOOLS } from './catalogue/tools.js';
import {
  CRISIS_ROUTES,
  DEMAND_KINDS,
  DEMAND_TRAITS,
  NEEDS,
  NOT_SURE_QUESTIONS,
  PATTERNS,
  SAFETY_EXCLUSIONS,
  SAFETY_PHRASES,
  THRESHOLDS,
  notSureRules,
} from './catalogue/rules.js';
import type { WorkbookTables } from './workbook.js';

export const WORKBOOK_VERSION = '3.3';

// Tab 4: step caps and urgency weight per timeline code.
const TIMELINE_RULES: Readonly<
  Record<TimelineCode, { readonly stepCap: number; readonly urgency: number }>
> = {
  T0: { stepCap: 3, urgency: 1 },
  T1: { stepCap: 5, urgency: 0.8 },
  T2: { stepCap: 8, urgency: 0.5 },
  T3: { stepCap: 10, urgency: 0.25 },
  T4: { stepCap: 10, urgency: 0.2 },
  T5: { stepCap: 10, urgency: 0 },
  T6: { stepCap: 10, urgency: 0 },
  TX: { stepCap: 3, urgency: 0.8 },
  TR: { stepCap: 5, urgency: 0.5 },
};

// Plain wording instead of band names (CONFLICTS D-06 recommendation); shape icons so colour is
// never the only signal.
const LIGHTS: Readonly<
  Record<Light, { readonly label: string; readonly icon: string; readonly fallbackHex: string }>
> = {
  green: { label: 'Good to go', icon: '●', fallbackHex: '#5E8C61' },
  yellow: { label: 'Go gently', icon: '◐', fallbackHex: '#D8B64C' },
  amber: { label: 'Reduce the load first', icon: '▲', fallbackHex: '#D98A3D' },
  red: { label: 'Take care first', icon: '■', fallbackHex: '#B5574B' },
  blue: { label: 'Steadier', icon: '◆', fallbackHex: '#5B7FA6' },
};

/** Fallback "because" phrases for cells Tab 0 doesn't cover well. */
const BECAUSE_FALLBACK: Readonly<Record<string, string>> = {
  E1M1: 'running on empty',
  E1M2: 'low on fuel and feeling flat',
  E1M3: 'calm but running on empty',
  E1M4: 'peaceful but low on energy',
  E2M1: 'unsettled with a little energy',
  E2M2: 'warming up slowly',
  E2M3: 'building up steadily',
  E2M4: 'settled and willing',
  E3M1: 'energised but feeling friction',
  E3M2: 'getting going while your mood catches up',
  E3M3: 'steady with a clear head',
  E3M4: 'energised and in a good place',
  E4M1: 'full of energy but scattered',
  E4M2: 'wired and on edge',
  E4M3: 'charged up and steady',
  E4M4: 'full of energy and feeling good',
};

/** Canonical JSON (sorted keys) so the hash only changes when content does. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashSnapshot(snapshot: Omit<Snapshot, 'version'>): string {
  return createHash('sha256').update(canonicalJson(snapshot)).digest('hex');
}

export function buildSnapshot(tables: WorkbookTables): {
  readonly snapshot: Snapshot;
  readonly hash: string;
} {
  const timelines: SnapshotTimeline[] = tables.timelines.map((t) => ({
    ...t,
    ...TIMELINE_RULES[t.code],
  }));
  const lights = Object.fromEntries(
    (Object.keys(LIGHTS) as Light[]).map((light) => [
      light,
      {
        label: LIGHTS[light].label,
        icon: LIGHTS[light].icon,
        hex: tables.lightHex[light] ?? LIGHTS[light].fallbackHex,
      },
    ]),
  ) as Snapshot['lights'];
  const body: Omit<Snapshot, 'version'> = {
    workbookVersion: WORKBOOK_VERSION,
    cells: tables.cells.map((c) => ({
      ...c,
      because: tables.becauseByCell.get(c.id) ?? BECAUSE_FALLBACK[c.id] ?? 'where you are',
    })),
    lights,
    families: FAMILIES,
    emotions: EMOTIONS,
    sensations: SENSATIONS,
    bodyRegions: BODY_REGIONS,
    environments: ENVIRONMENTS,
    socials: SOCIALS,
    times: TIMES,
    supports: SUPPORTS,
    sensitivityFlags: SENSITIVITY_FLAGS,
    needs: NEEDS,
    demandKinds: DEMAND_KINDS,
    demandTraits: DEMAND_TRAITS,
    timelines,
    tools: TOOLS,
    patterns: PATTERNS,
    notSure: { questions: NOT_SURE_QUESTIONS, rules: notSureRules() },
    safety: { phrases: SAFETY_PHRASES, exclusions: SAFETY_EXCLUSIONS },
    crisisRoutes: CRISIS_ROUTES,
    thresholds: THRESHOLDS,
  };
  const hash = hashSnapshot(body);
  return { snapshot: { version: `${WORKBOOK_VERSION}.0+${hash.slice(0, 8)}`, ...body }, hash };
}
