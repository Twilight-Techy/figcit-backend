// The explorer's check-ins (E-61): instead of engine facts, check-ins the app could send, each
// answer one of the version's options, with the server's facts as a new user (or Browse) would
// have them. Each becomes engine input through `factsFromCheckIn`, as a real check-in does, so a
// rule that never fires here can't be reached from the app. Pure and deterministic.
import { valuesOf, type Catalogue } from '../format/catalogue.js';
import type { InputOptions } from '../format/inputs.js';
import { canonicalJson, type JsonValue } from '../ruleset/canonical.js';
import { factsFromCheckIn, type AnswerRef, type CheckInValues } from './check-in.js';
import { DEFAULT_SAMPLE, DEFAULT_SEED, edgesOf, pairwise, seeded } from './flows.js';
import { primaryKey } from './checks.js';
import { run } from './run.js';
import type { Card, CompiledRuleset, EngineInput } from './types.js';

export type Account = 'browse' | 'free' | 'plus';

/** A check-in as the explorer makes it: the parts of the app's check-in the engine reads. */
export interface CaseCheckIn extends CheckInValues {
  readonly demand?: {
    readonly timeline?: string;
    readonly traits?: readonly string[];
    readonly puttingOff?: boolean;
  };
  /** Only for a case with a risk: words the server's risk check matches. */
  readonly ownWords?: string;
}

export interface CheckInCase {
  readonly checkIn: CaseCheckIn;
  readonly account: Account;
  /** A signed-in new user's signals that differ from a new user's (Browse has none). */
  readonly signals: Readonly<Record<string, boolean | number>>;
  /** A tool declined with "Try another": its pathway is just rejected, as the app's rerun marks it. */
  readonly declined: readonly string[];
  readonly input: EngineInput;
}

export interface CaseContext {
  readonly options: InputOptions;
  /** A signed-in new user's signals, as the server sends them (without the plan). */
  readonly newUser: EngineInput;
  /** Words the server's risk check matches; without them, no case has a risk. */
  readonly riskText?: string;
}

/** The answers a case is made of. */
interface Answers {
  readonly state: CheckInValues['state'];
  readonly feeling: string | null;
  readonly level: number | null;
  readonly feeling2: string | null;
  readonly level2: number | null;
  readonly sensation: string | null;
  readonly sensationLevel: number | null;
  readonly place: string | null;
  readonly support: string | null;
  readonly sense: string | null;
  readonly need: string | null;
  readonly justSupport: boolean;
  readonly timeline: string | null;
  readonly trait: string | null;
  readonly puttingOff: boolean;
  readonly account: Account;
  readonly signals: Readonly<Record<string, boolean | number>>;
  readonly risk: boolean;
  readonly declined: string | null;
}

const BASE: Answers = {
  state: { kind: 'grid', energy: 2, mood: 2 },
  feeling: null,
  level: null,
  feeling2: null,
  level2: null,
  sensation: null,
  sensationLevel: null,
  place: null,
  support: null,
  sense: null,
  need: null,
  justSupport: false,
  timeline: null,
  trait: null,
  puttingOff: false,
  account: 'free',
  signals: {},
  risk: false,
  declined: null,
};

/** One value of a dimension: what it changes, and the answer it stands for (none for the first). */
interface Value {
  readonly set: (a: Answers) => Answers;
  readonly answer: AnswerRef | null;
}
/** One dimension of the check-in; value 0 leaves the answers as they are. */
interface Dim {
  readonly name: string;
  readonly values: readonly Value[];
}

const KEEP: Value = { set: (a) => a, answer: null };
const pick = (name: keyof Answers, input: string, codes: readonly string[]): Dim => ({
  name,
  values: [
    KEEP,
    ...codes.map((code) => ({
      set: (a: Answers) => ({ ...a, [name]: code }),
      answer: { input, code },
    })),
  ],
});
const levels = (name: keyof Answers, input: string, list: readonly number[]): Dim => ({
  name,
  values: [
    KEEP,
    ...list.map((n) => ({
      set: (a: Answers) => ({ ...a, [name]: n }),
      answer: { input, code: String(n) },
    })),
  ],
});
const flag = (name: keyof Answers, input: string): Dim => ({
  name,
  values: [
    KEEP,
    { set: (a: Answers) => ({ ...a, [name]: true }), answer: { input, code: 'true' } },
  ],
});

const CELLS = [1, 2, 3, 4].flatMap((energy) => [1, 2, 3, 4].map((mood) => ({ energy, mood })));

/** Every grid cell, Not sure without a confirmed cell, and skipped (Quick entry). */
function stateDim(): Dim {
  const states: CheckInValues['state'][] = [
    ...CELLS.map((c) => ({ kind: 'grid' as const, ...c })),
    { kind: 'not_sure' },
    { kind: 'not_given' },
  ];
  return {
    name: 'state',
    values: states.map((state) => ({
      set: (a: Answers) => ({ ...a, state }),
      answer: {
        input: 'state',
        code: state.kind === 'grid' ? `E${String(state.energy)}M${String(state.mood)}` : state.kind,
      },
    })),
  };
}

/** The account: a plan, or Browse; and each of a new user's signals, at the values rules tell apart. */
function accountDims(ruleset: CompiledRuleset, ctx: CaseContext): Dim[] {
  const plans: Dim = {
    name: 'account',
    values: [
      KEEP,
      ...(['plus', 'browse'] as const).map((account) => ({
        set: (a: Answers) => ({ ...a, account }),
        answer: { input: 'account', code: account },
      })),
    ],
  };
  const signals = Object.entries(ctx.newUser).flatMap(([fact, start]): Dim[] => {
    const others =
      typeof start === 'boolean'
        ? [!start]
        : typeof start === 'number'
          ? edgesOf(ruleset, fact).filter((n) => n !== start)
          : [];
    if (others.length === 0) return [];
    return [
      {
        name: fact,
        values: [
          KEEP,
          ...others.map((v) => ({
            set: (a: Answers) => ({ ...a, signals: { ...a.signals, [fact]: v } }),
            answer: { input: fact, code: String(v) },
          })),
        ],
      },
    ];
  });
  return [plans, ...signals];
}

/** "Try another" on each pathway: one of its tools declined (the rerun rejects the pathway). */
function declinedDim(catalogue: Catalogue): Dim {
  const firstTools = new Map<string, string>();
  for (const t of valuesOf(catalogue, 'tool'))
    if (t.group && !firstTools.has(t.group)) firstTools.set(t.group, t.code);
  return {
    name: 'declined',
    values: [
      KEEP,
      ...[...firstTools.values()].map((tool) => ({
        set: (a: Answers) => ({ ...a, declined: tool }),
        answer: { input: 'declined', code: tool },
      })),
    ],
  };
}

/** Every answer the check-in screens offer, at the intensities the rules tell apart. */
function dimensions(ruleset: CompiledRuleset, ctx: CaseContext, catalogue: Catalogue): Dim[] {
  const o = ctx.options;
  const codes = (list: readonly { code: string }[]): string[] => list.map((x) => x.code);
  const feelingLevels = edgesOf(ruleset, 'family.intensity');
  return [
    stateDim(),
    pick('feeling', 'emotions', codes(o.feeling)),
    levels('level', 'emotions.intensity', feelingLevels),
    pick('feeling2', 'emotions', codes(o.feeling)),
    levels('level2', 'emotions.intensity', feelingLevels),
    pick('sensation', 'sensations', codes(o.sensation)),
    levels('sensationLevel', 'sensations.intensity', edgesOf(ruleset, 'sensation.intensity')),
    pick('place', 'context.environment', codes(o.place)),
    pick('support', 'context.supports', codes(o.support)),
    pick('sense', 'context.sensitivity', codes(o.sense)),
    pick('need', 'needs', codes(o.need)),
    flag('justSupport', 'justSupport'),
    pick('timeline', 'demand.timeline', codes(o.timeline)),
    pick('trait', 'demand.traits', codes(valuesOf(catalogue, 'demand_characteristic'))),
    flag('puttingOff', 'demand.puttingOff'),
    ...accountDims(ruleset, ctx),
    ...(ctx.riskText ? [flag('risk', 'ownWords')] : []),
    declinedDim(catalogue),
  ];
}

/** Needs that only make sense with a task: the app requires the task step for them (E-45). */
function taskNeeds(ctx: CaseContext, catalogue: Catalogue): ReadonlySet<string> {
  const needing = new Set(
    valuesOf(catalogue, 'need')
      .filter((v) => v.group === 'task_needed')
      .map((v) => v.code),
  );
  return new Set(
    ctx.options.need
      .filter((o) => o.mapsTo && 'domain' in o.mapsTo && needing.has(o.mapsTo.code))
      .map((o) => o.code),
  );
}

/** The case's task: none with "just support"; one when a timeline is given or a need requires it. */
function demandOf(
  a: Answers,
  need: string | null,
  needsTask: boolean,
  firstTimeline: string,
): CaseCheckIn['demand'] {
  if (a.justSupport || (a.timeline === null && !(need && needsTask))) return undefined;
  return {
    timeline: a.timeline ?? firstTimeline,
    ...(a.trait ? { traits: [a.trait] } : {}),
    ...(a.puttingOff ? { puttingOff: true } : {}),
  };
}

/** The feelings and the sensation the answers give (a second feeling only if it differs). */
function feltOf(a: Answers): Pick<CaseCheckIn, 'emotions' | 'sensations'> {
  const second = a.feeling2 && a.feeling2 !== a.feeling ? a.feeling2 : null;
  const rated = a.sensationLevel === null ? {} : { intensity: a.sensationLevel };
  return {
    emotions: [
      ...(a.feeling ? [{ code: a.feeling, intensity: a.level }] : []),
      ...(second ? [{ code: second, intensity: a.level2 }] : []),
    ],
    sensations: a.sensation ? [{ code: a.sensation, ...rated }] : [],
  };
}

/** The check-in the answers make, kept to what the app lets through. */
function checkInOf(a: Answers, ctx: CaseContext, needing: ReadonlySet<string>): CaseCheckIn {
  // "Just support" leaves out the task, so a need about a task can't come with it (the server
  // refuses that pair).
  const need = a.need && a.justSupport && needing.has(a.need) ? null : a.need;
  const firstTimeline = ctx.options.timeline[0]?.code ?? 'T3';
  const demand = demandOf(a, need, need !== null && needing.has(need), firstTimeline);
  return {
    state: a.state,
    ...feltOf(a),
    context: {
      ...(a.place ? { environment: a.place } : {}),
      ...(a.support ? { supports: [a.support] } : {}),
      ...(a.sense ? { sensitivity: [a.sense] } : {}),
    },
    needs: need ? [need] : [],
    justSupport: a.justSupport,
    ...(demand ? { demand } : {}),
    ...(a.risk && ctx.riskText ? { ownWords: ctx.riskText } : {}),
  };
}

/** The account's facts as DecisionsService.prepare adds them: Browse gets only the free plan. */
const serverOf = (a: Answers, ctx: CaseContext): EngineInput =>
  a.account === 'browse'
    ? { 'signals.plan': 'free' }
    : { ...ctx.newUser, ...a.signals, 'signals.plan': a.account };

/** The check-in the answers make and its engine input, as a real check-in gets it. */
function caseOf(
  a: Answers,
  ctx: CaseContext,
  ruleset: CompiledRuleset,
  needing: ReadonlySet<string>,
): CheckInCase {
  const checkIn = checkInOf(a, ctx, needing);
  const input = factsFromCheckIn(checkIn, ctx.options, ruleset.catalogue, {
    timeline: checkIn.demand?.timeline,
    facts: { ...serverOf(a, ctx), 'safety.risk': a.risk && Boolean(ctx.riskText) },
  });
  // As CardBridgeService.rerun: the declined tool's pathway is just rejected.
  const pathway = a.declined
    ? valuesOf(ruleset.catalogue, 'tool').find((t) => t.code === a.declined)?.group
    : undefined;
  return {
    checkIn,
    account: a.account,
    signals: a.account === 'browse' ? {} : a.signals,
    declined: a.declined ? [a.declined] : [],
    input: pathway ? { ...input, 'signals.rejected': [pathway] } : input,
  };
}

const answersAt = (dims: readonly Dim[], row: readonly number[]): Answers =>
  dims.reduce<Answers>((a, d, i) => (d.values[row[i] ?? 0] ?? KEEP).set(a), BASE);

/** A random row: the state and a feeling are given 9 times in 10, any other answer 1 in 3. */
function sampleRow(dims: readonly Dim[], random: () => number): number[] {
  return dims.map((d) => {
    const core = d.name === 'state' || d.name === 'feeling' || d.name === 'level';
    if (d.name === 'state') return Math.floor(random() * d.values.length);
    return random() < (core ? 0.9 : 1 / 3) ? 1 + Math.floor(random() * (d.values.length - 1)) : 0;
  });
}

export interface CaseSet {
  readonly cases: readonly CheckInCase[];
  /** Every state with every feeling at every level; pairwise over every answer; random. */
  readonly parts: { readonly core: number; readonly pairwise: number; readonly sample: number };
}

/**
 * The explorer's check-ins (E-61): every state with every feeling at each level the rules tell
 * apart and nothing else; a pairwise covering set over every answer of every screen and the
 * account; and a seeded random sample. Repeats are dropped.
 */
export function checkInCases(
  ruleset: CompiledRuleset,
  ctx: CaseContext,
  options: { readonly sample?: number; readonly seed?: number } = {},
): CaseSet {
  const random = seeded(options.seed ?? DEFAULT_SEED);
  const dims = dimensions(ruleset, ctx, ruleset.catalogue);
  const needing = taskNeeds(ctx, ruleset.catalogue);
  const make = (a: Answers): CheckInCase => caseOf(a, ctx, ruleset, needing);
  const [state, feeling, level] = dims as [Dim, Dim, Dim];
  const core = state.values.flatMap((s) =>
    feeling.values.flatMap((f) => level.values.map((l) => make(l.set(f.set(s.set(BASE)))))),
  );
  const pairs = pairwise(
    dims.map((d) => d.values.length),
    random,
  ).map((row) => make(answersAt(dims, row)));
  const sample = Array.from({ length: options.sample ?? DEFAULT_SAMPLE }, () =>
    make(answersAt(dims, sampleRow(dims, random))),
  );
  const seen = new Set<string>();
  const cases = [...core, ...pairs, ...sample].filter((c) => {
    const key = canonicalJson({
      checkIn: c.checkIn,
      account: c.account,
      signals: c.signals,
    } as unknown as JsonValue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { cases, parts: { core: core.length, pairwise: pairs.length, sample: sample.length } };
}

// ---- the state grid (DESIGN §8 outcome map, as the State Grid) ----

export interface GridChoice {
  /** The feeling picked, as the user picks it (an option code), or none. */
  readonly feeling: string | null;
  readonly intensity: number | null;
  readonly account: Account;
}

/** A card as the grid shows it (the whole card, so the caller can present it as the app does). */
export interface GridOutcome {
  readonly light: string | null;
  readonly kind: Card['kind'];
  readonly card: Card;
  /** `primaryKey` of the card: what makes two outcomes the same. */
  readonly key: string;
}

export interface GridCell {
  /** `E2M3`. */
  readonly cell: string;
  /** The check-in of the cell: its state and the feeling picked, nothing else. */
  readonly case: CheckInCase;
  /** Null when the engine refused the input. */
  readonly outcome: GridOutcome | null;
  /** Each single other answer that gives a different card. */
  readonly changes: readonly { readonly answer: AnswerRef; readonly outcome: GridOutcome }[];
}

function outcomeOf(ruleset: CompiledRuleset, c: CheckInCase): GridOutcome | null {
  const r = run(ruleset, c.input);
  if (!r.ok) return null;
  return {
    light: r.card.light,
    kind: r.card.kind,
    card: r.card,
    key: primaryKey(r.card),
  };
}
const same = (a: GridOutcome | null, b: GridOutcome | null): boolean =>
  a?.light === b?.light && a?.kind === b?.kind && a?.key === b?.key;

/**
 * The state grid (DESIGN §8 outcome map, E-61): for a feeling picked, the card of each of the
 * 16 cells with nothing else answered, and each single other answer (every option of every other
 * screen, the plan, each signal) that changes that card. The level dimensions are left out:
 * alone they change nothing. 16 × about 250 runs.
 */
export function stateGrid(
  ruleset: CompiledRuleset,
  ctx: CaseContext,
  choice: GridChoice,
): GridCell[] {
  const dims = dimensions(ruleset, ctx, ruleset.catalogue).filter(
    (d) => !['state', 'feeling', 'level', 'level2', 'sensationLevel'].includes(d.name),
  );
  const needing = taskNeeds(ctx, ruleset.catalogue);
  return CELLS.map(({ energy, mood }) => {
    const answers: Answers = {
      ...BASE,
      state: { kind: 'grid', energy, mood },
      feeling: choice.feeling,
      level: choice.intensity,
      account: choice.account,
    };
    const base = caseOf(answers, ctx, ruleset, needing);
    const outcome = outcomeOf(ruleset, base);
    const changes = dims.flatMap((d) =>
      d.values.flatMap((v) => {
        if (!v.answer) return [];
        const other = outcomeOf(ruleset, caseOf(v.set(answers), ctx, ruleset, needing));
        return other && !same(other, outcome) ? [{ answer: v.answer, outcome: other }] : [];
      }),
    );
    return { cell: `E${String(energy)}M${String(mood)}`, case: base, outcome, changes };
  });
}
