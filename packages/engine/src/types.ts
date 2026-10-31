// Public types of @figcit/engine. Codes keep the workbook's IDs exactly (rules 2.4).

export const PATHWAYS = [
  'regulate',
  'dump',
  'express',
  'execute',
  'adapt',
  'reflect',
  'connect',
  'meditate',
] as const;
export type Pathway = (typeof PATHWAYS)[number];

/** Capacity bands, lowest first. The index is the band's "step". */
export const BANDS = ['very_constrained', 'constrained', 'conditional', 'available'] as const;
export type Band = (typeof BANDS)[number];

export type Light = 'green' | 'yellow' | 'amber' | 'red' | 'blue';

export const TIMELINE_CODES = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'TX', 'TR'] as const;
export type TimelineCode = (typeof TIMELINE_CODES)[number];

export const DRIVERS = [
  'novelty',
  'urgency',
  'challenge',
  'routine',
  'interest',
  'passion',
  'collaboration',
  'exploration',
] as const;
export type Driver = (typeof DRIVERS)[number];

export type IntensityBand = 'mild' | 'moderate' | 'high' | 'very_high';

/** Setting classes from Tab 3b / 6c section D. */
export type SettingClass =
  | 'private'
  | 'in_bed'
  | 'work_school'
  | 'observed'
  | 'formal'
  | 'exam'
  | 'clinical'
  | 'public'
  | 'transit'
  | 'unfamiliar'
  | 'caring'
  | 'prayer_room'
  | 'worship'
  | 'outdoors'
  | 'social_event';

export type Plan = 'free' | 'plus';

// ---------------------------------------------------------------------------
// Snapshot (data produced by @figcit/rules-compiler; changeable without a release)
// ---------------------------------------------------------------------------

export interface SnapshotCell {
  readonly id: string; // E1M1…E4M4
  readonly energy: number; // 1–4
  readonly mood: number; // 1–4
  readonly name: string;
  readonly icon: string;
  readonly meaning: string;
  readonly band: Band;
  /** Phrase for the rationale: "Because you're <because>…". */
  readonly because: string;
}

export interface SnapshotFamily {
  readonly code: string;
  readonly label: string;
  readonly valence: 'negative' | 'positive' | 'neutral';
  /** EX-1: lowers the band at High+ ('high'), at any intensity ('any'), or never (null). */
  readonly ex1: 'high' | 'any' | null;
  /** Counts as a negative experience family for CX-1. */
  readonly cx1: boolean;
  /** Phrase for the rationale: "…and <feeling>". `{intensity}` is replaced by mild/high etc. */
  readonly feeling: string;
}

export interface SnapshotEmotion {
  readonly code: string;
  readonly label: string;
  readonly emoji: string;
  readonly family: string;
  readonly side: 'harder' | 'lighter';
  /** Selecting this emotion at or above this intensity is a risk option (SF-1). */
  readonly riskAtIntensity?: number;
}

export type SensationFlag =
  | 'pain'
  | 'shutdown'
  | 'detached'
  | 'overload'
  | 'word_finding'
  | 'racing'
  | 'hyperfocus'
  | 'restless'
  | 'interoception_unmet'
  | 'masking';

export interface SnapshotSensation {
  readonly code: string;
  readonly label: string;
  readonly category:
    'sensory' | 'cognitive' | 'body' | 'communication' | 'movement' | 'interoception';
  readonly flags: readonly SensationFlag[];
}

export interface SnapshotEnvironment {
  readonly code: string;
  readonly label: string;
  readonly settingClass: SettingClass;
  /** Shown on S10 without expanding "More places". */
  readonly common: boolean;
  /** Tool ids removed in this setting (Tab 3b "Tools excluded"). */
  readonly excludeTools: readonly string[];
}

export interface SnapshotOption {
  readonly code: string;
  readonly label: string;
  readonly emoji?: string;
}

export interface SnapshotNeed {
  readonly code: string;
  readonly label: string; // what the user sees (Tab 6b)
  readonly route: readonly Pathway[];
  readonly nucripce: boolean;
  readonly worksWithoutTask: boolean;
  /** Pattern this need leads to when no stronger trigger applies. */
  readonly pattern?: number;
  readonly common: boolean;
}

export interface SnapshotTimeline {
  readonly code: TimelineCode;
  readonly label: string;
  readonly definition: string;
  /** Max Execute steps (Tab 4). */
  readonly stepCap: number;
  /** Urgency weight 0–1 (0 = Urgency not tagged). */
  readonly urgency: number;
}

export interface SnapshotDemandKind {
  readonly code: string;
  readonly label: string;
}

export interface SnapshotTool {
  readonly id: string;
  readonly pathway: Pathway;
  readonly name: string;
  readonly tier: 'free' | 'advanced';
  readonly safetyFloor: boolean;
  /** Works discreetly in public / observed settings. */
  readonly discreet: boolean;
  readonly eyesOpen: boolean;
  /** Needs audio out (headphones in public). */
  readonly audio: boolean;
  /** Needs visible / large movement. */
  readonly movement: boolean;
  /** Needs typing or speaking. */
  readonly verbal: boolean;
  /** Needs standing up or leaving. */
  readonly leave: boolean;
  readonly minutes: number;
  /** Reflect / Meditate formats that 6c section D filters. */
  readonly practiceFormat?:
    'silent' | 'spoken' | 'eyes_closed' | 'body_scan' | 'written' | 'chips' | 'walking';
}

export type ActionKind =
  | 'pathway'
  | 'support' // Get support now (Help / SOS)
  | 'skip_to_task'
  | 'try_anyway'
  | 'save_for_later'
  | 'remind_later'
  | 'check_in_again'
  | 'open_home'
  | 'own_practice'
  | 'quiet_message'; // one-tap pre-written "I need quiet" message (pattern 16)

export interface SnapshotPattern {
  readonly id: number;
  readonly title: string; // the CTA headline, e.g. “Let's reduce the load first”
  readonly button: string; // e.g. Try a short reset
  readonly alternatives: readonly string[]; // alternative labels from Tab 7
  readonly suggestion: string; // rationale: "FigCit <suggestion>" (app name: DECISIONS B-48)
}

export interface SafetyPhraseGroup {
  readonly id: string; // rule id, e.g. SF-1.suicide
  readonly category: string;
  readonly phrases: readonly string[];
}

export interface CrisisRoute {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly href: string;
  readonly kind: 'call' | 'text' | 'link';
}

export interface NotSureRule {
  /** body, energy, comfort answers (codes) → suggested cell. First match wins; '*' matches any. */
  readonly when: readonly [string, string, string];
  readonly cell: string;
}

export interface Thresholds {
  readonly high: number; // 7
  readonly veryHigh: number; // 9
  readonly moderate: number; // 4
  readonly cx1Flags: number; // 2
  readonly maxBandDrop: number; // 2 (CAP-1)
  readonly recoveryMinutes: number; // 45
  readonly recheckImprovedIntensityDrop: number; // 2
  readonly ruminationTopicCount: number; // 3 in 7 days
  readonly recurringStruggleCount: number; // 3 in 14 days
  readonly declinesBeforeQuiet: number; // 3
  readonly quietPeriodMinutes: number;
  readonly publicMeditateMaxMinutes: number; // 3
  readonly sustainedRedDays: number; // 7
  readonly sustainedNoImprovementDays: number; // 14
  readonly maxEmotions: number; // 3
  readonly aiConfidence: number; // 0.7
}

export interface Snapshot {
  readonly version: string;
  readonly workbookVersion: string;
  readonly cells: readonly SnapshotCell[];
  readonly lights: Readonly<
    Record<Light, { readonly label: string; readonly hex: string; readonly icon: string }>
  >;
  readonly families: readonly SnapshotFamily[];
  readonly emotions: readonly SnapshotEmotion[];
  readonly sensations: readonly SnapshotSensation[];
  readonly bodyRegions: readonly SnapshotOption[];
  readonly environments: readonly SnapshotEnvironment[];
  readonly socials: readonly (SnapshotOption & {
    readonly observed: boolean;
    readonly othersPresent: boolean;
  })[];
  readonly times: readonly SnapshotOption[];
  readonly supports: readonly SnapshotOption[];
  readonly sensitivityFlags: readonly SnapshotOption[];
  readonly needs: readonly SnapshotNeed[];
  readonly demandKinds: readonly SnapshotDemandKind[];
  readonly demandTraits: readonly (SnapshotOption & { readonly drivers: readonly Driver[] })[];
  readonly timelines: readonly SnapshotTimeline[];
  readonly tools: readonly SnapshotTool[];
  readonly patterns: readonly SnapshotPattern[];
  readonly notSure: {
    readonly questions: readonly {
      readonly code: string;
      readonly label: string;
      readonly options: readonly SnapshotOption[];
    }[];
    readonly rules: readonly NotSureRule[];
  };
  readonly safety: {
    readonly phrases: readonly SafetyPhraseGroup[];
    /** Phrases that look risky but aren't (e.g. "dying to see"), removed before matching. */
    readonly exclusions: readonly string[];
  };
  readonly crisisRoutes: Readonly<Record<string, readonly CrisisRoute[]>>;
  readonly thresholds: Thresholds;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface EmotionInput {
  readonly code: string;
  readonly intensity: number; // 0–10
}

export interface SensationInput {
  readonly code: string;
  readonly intensity?: number;
  readonly bodyRegions?: readonly string[];
}

export interface ContextInput {
  readonly environment?: string;
  readonly social?: string;
  readonly time?: string;
  readonly support?: string;
  readonly sensitivity?: readonly string[];
}

export interface DemandInput {
  readonly kind?: string; // study | work | health | social | home
  readonly timeline: TimelineCode;
  /** Demand characteristics (Tab 6), e.g. first_time, done_before, communication, multiple. */
  readonly traits?: readonly string[];
  readonly puttingOff?: boolean;
  /** Drivers the user confirmed from the AI suggestion (S92); merged with rule-derived ones. */
  readonly confirmedDrivers?: readonly Driver[];
  /** Number of competing demands listed (pattern 22). */
  readonly count?: number;
  readonly title?: string; // used only for CTA slots, never logged by the engine
}

export interface EngineInput {
  /** 'quick' = "I need help with…" entry (D-39). */
  readonly entry?: 'full' | 'quick';
  readonly state:
    | { readonly kind: 'grid'; readonly energy: number; readonly mood: number }
    | {
        readonly kind: 'not_sure';
        readonly answers?: readonly string[];
        /** The cell the user confirmed on S151, if they did. */
        readonly confirmedCell?: string;
      };
  readonly emotions?: readonly EmotionInput[];
  readonly sensations?: readonly SensationInput[];
  readonly context?: ContextInput;
  readonly needs?: readonly string[];
  readonly justSupport?: boolean;
  readonly demand?: DemandInput;
  /** Free text the user typed or spoke anywhere in this check-in (safety screen only). */
  readonly freeText?: readonly string[];
  /** The user explicitly chose a pathway (e.g. tapped Meditate from Home). */
  readonly intent?: Pathway;
  /** Adaptations applied (Adapt re-run): adaptation kinds the user chose. */
  readonly adaptations?: readonly string[];
  /** Re-check after a support session (Tab 8 step 11). */
  readonly recheckOf?: PreviousOutcome;
}

export interface PreviousOutcome {
  readonly cellId: string;
  readonly finalBand: Band;
  readonly light: Light;
  readonly peakIntensity: number;
  readonly supportCompleted: boolean;
  readonly safetyTriggered: boolean;
  /** Tool used in the session that preceded this re-check (not repeated if it didn't help). */
  readonly toolId?: string;
  readonly pathway?: Pathway;
  readonly helped?: 'helped' | 'a_bit' | 'not_really' | 'skipped';
}

export interface SavedPracticeSignal {
  readonly id: string;
  readonly name: string;
  readonly type: 'ritual' | 'prayer' | 'recitation' | 'meditation' | 'other';
  readonly helpsWhenStruggling: boolean;
  readonly isTransition: boolean;
  readonly dueNow: boolean;
  readonly opening?: boolean;
  readonly closing?: boolean;
}

/** What the API (or the device) already knows. The engine never queries anything. */
export interface UserSignals {
  readonly plan: Plan;
  /** Suggestions declined in this session (pattern 30). */
  readonly declinesThisSession?: number;
  /** Tools the user rejected recently; not repeated immediately. */
  readonly rejectedToolIds?: readonly string[];
  /** Reflections per topic in the last 7 days with no improvement (RF-2). */
  readonly ruminationTopics?: readonly string[];
  /** A recurring struggle the user confirmed (pattern 34). */
  readonly recurringStruggleConfirmed?: boolean;
  readonly meditationMakesWorse?: boolean;
  readonly bodyScanOptIn?: boolean;
  readonly patternPromptsOff?: boolean;
  readonly savedPractices?: readonly SavedPracticeSignal[];
  readonly hasTrustedContact?: boolean;
  readonly safetyEventRecently?: boolean;
  readonly inSession?: boolean;
  readonly dismissedAdvanced?: boolean;
  /** Blue recovery window still open from an earlier re-check. */
  readonly recoveryActive?: boolean;
  /** Validated outcomes per tool: helped count minus not-helped count (personalisation). */
  readonly toolScores?: Readonly<Record<string, number>>;
  readonly personalisation?: boolean;
  /** Region for crisis routes. */
  readonly region?: string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface Action {
  readonly kind: ActionKind;
  readonly label: string;
  readonly pathway?: Pathway;
  readonly toolId?: string;
  readonly advanced?: boolean;
  /** Minutes for remind_later; length hint for tools. */
  readonly minutes?: number;
  readonly practiceId?: string;
}

export interface Modifier {
  readonly rule: 'EX-1' | 'CX-1' | 'CAP-1' | 'E4M1' | 'NS-1' | 'RC-3';
  readonly steps: number;
  readonly reason: string;
}

export interface GateResult {
  readonly rule: string; // RF-1…RF-5, MD-1…MD-6, ENT-1…ENT-3
  readonly effect: 'allowed' | 'limited' | 'blocked';
  readonly detail: string;
}

export interface TraceStep {
  readonly stage: number;
  readonly name: string;
  readonly notes: readonly string[];
}

export interface EngineResult {
  readonly engineVersion: string;
  readonly snapshotVersion: string;
  readonly safety: {
    readonly triggered: boolean;
    readonly ruleId?: string;
    readonly category?: string;
    readonly source?: 'phrase' | 'option';
  };
  readonly state: {
    readonly cellId: string; // E1M1… or NS-1 when unconfirmed
    readonly name: string;
    readonly icon: string;
    readonly meaning: string;
    readonly confirmed: boolean;
  };
  readonly band: {
    readonly baseline: Band;
    readonly final: Band;
    readonly modifiers: readonly Modifier[];
  };
  readonly light: Light;
  readonly patterns: readonly number[];
  readonly primary: Action;
  readonly alternatives: readonly Action[];
  readonly queuedStep?: Action;
  readonly supportVisible: boolean;
  readonly notNow: boolean;
  readonly title: string;
  readonly rationale: { readonly templateId: string; readonly text: string };
  readonly drivers: readonly Driver[];
  readonly timeline?: { readonly code: TimelineCode; readonly stepCap: number };
  readonly gates: readonly GateResult[];
  readonly setting: {
    readonly settingClass: SettingClass;
    readonly sensitivityCount: number;
    readonly excludedTools: readonly string[];
  };
  readonly recheck?: {
    readonly outcome: 'improved' | 'same' | 'worse';
    readonly rule: 'RC-1' | 'RC-4' | 'RC-5';
  };
  readonly trace: readonly TraceStep[];
}
