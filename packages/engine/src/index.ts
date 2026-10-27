// Public API of @figcit/engine (SYSTEM_DESIGN §5). Pure: no I/O, clocks or randomness.
export { assertNever } from './assert-never.js';
export { ENGINE_VERSION, evaluate, evaluateRecheck } from './evaluate.js';
export { compileSnapshot } from './snapshot.js';
export { suggestCell } from './stages/state.js';
export { intensityBand } from './stages/experience.js';
export { normalise } from './safety/normalize.js';
export { buildSafetyScreen, type SafetyScreen } from './safety/screen.js';
export * from './types.js';
