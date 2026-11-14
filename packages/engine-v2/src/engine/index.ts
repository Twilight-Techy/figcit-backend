export {
  compare,
  explore,
  type CardChange,
  type CompareReport,
  publishChecks,
  type ExploreReport,
  type Outcome,
  type OutcomeCell,
  type Query,
  PUBLISH_CHECKS,
  sweepInputs,
  type PublishCheckId,
  type PublishCheckReport,
  type Violation,
} from './checks.js';
export {
  explainCheckIn,
  factsFromCheckIn,
  foldContributions,
  type AnswerRef,
  type CheckInExplained,
  type CheckInValues,
  type Contribution,
  type ServerFacts,
  type Unmapped,
} from './check-in.js';
export { compile } from './compile.js';
export {
  COMPUTED_FROM,
  DEFAULT_SAMPLE,
  DEFAULT_SEED,
  factsRead,
  flowInputs,
  pairwise,
  SAFETY_CAP,
  safetyInputs,
  seeded,
  withoutRows,
  ruleReads,
  type FlowOptions,
  type FlowSet,
  type SafetySet,
} from './flows.js';
export {
  checkInCases,
  stateGrid,
  type Account,
  type CaseCheckIn,
  type CaseContext,
  type CaseSet,
  type CheckInCase,
  type GridCell,
  type GridChoice,
  type GridOutcome,
} from './checkin-cases.js';
export { producible, unreachable, type Producible } from './reach.js';
export { checkInput } from './input.js';
export { factsFromCheckInV5, type CheckInV5, type DroppedAnswer } from './check-in-v5.js';
export { ENGINE_FORMATS, ENGINE_VERSION, run, type RunOptions } from './run.js';
export { MAX_ALTERNATIVES } from './card.js';
export { cardWordsV5, type CardTask, type CardWordsV5, type WordsSources } from './words-v5.js';
export type {
  Card,
  CardItem,
  CompiledRule,
  CompiledRuleset,
  EngineInput,
  EngineRow,
  ProposalFate,
  RuleCheck,
  RunResult,
  Trace,
} from './types.js';
