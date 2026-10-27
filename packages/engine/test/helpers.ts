import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EngineInput, Light, Snapshot, UserSignals } from '../src/index.js';

export const snapshot: Snapshot = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../fixtures/snapshot.json'), 'utf8'),
) as Snapshot;

export interface ScenarioFixture {
  readonly ref: string;
  readonly source: 'tab0' | 'tab0b';
  readonly input: EngineInput;
  readonly signals: UserSignals;
  readonly expect: {
    readonly patterns: readonly number[];
    readonly light?: Light;
    readonly title: string;
  };
}

export const scenarios: readonly ScenarioFixture[] = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../fixtures/scenarios.json'), 'utf8'),
) as ScenarioFixture[];

export const free: UserSignals = { plan: 'free' };
export const plus: UserSignals = { plan: 'plus' };

export const grid = (energy: number, mood: number): EngineInput['state'] => ({
  kind: 'grid',
  energy,
  mood,
});
