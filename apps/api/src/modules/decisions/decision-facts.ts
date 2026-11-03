import type { UserSignals } from '@figcit/engine';
import { valuesOf, type Card, type Catalogue, type EngineInput } from '@figcit/engine-v2';

/**
 * The v1 signal loader's answers as engine v2 facts (M5, E-52). What v2 has no fact for is left
 * out: per-topic rumination (deferred, ADR 0007), trusted contacts and tool scores (no rule reads
 * them).
 */
export function signalFacts(s: UserSignals, catalogue: Catalogue): EngineInput {
  const pathwayOf = new Map(valuesOf(catalogue, 'tool').map((t) => [t.code, t.group]));
  const rejected = [
    ...new Set(
      (s.rejectedToolIds ?? []).flatMap((t) => {
        const p = pathwayOf.get(t);
        return p ? [p] : [];
      }),
    ),
  ];
  return {
    'signals.plan': s.plan,
    'signals.declines_session': s.declinesThisSession ?? 0,
    'signals.safety_event_recently': s.safetyEventRecently ?? false,
    'signals.in_session': s.inSession ?? false,
    'signals.advanced_dismissed': s.dismissedAdvanced ?? false,
    'signals.recovery_window_open': s.recoveryActive ?? false,
    'signals.practice_due': (s.savedPractices ?? []).some((p) => p.dueNow),
    'signals.recurring_struggle': s.recurringStruggleConfirmed ?? false,
    'signals.practice_helps': (s.savedPractices ?? []).some((p) => p.helpsWhenStruggling),
    'prefs.meditation_worse': s.meditationMakesWorse ?? false,
    'prefs.body_scan_opt_in': s.bodyScanOptIn ?? false,
    ...(rejected.length > 0 ? { 'signals.rejected': rejected } : {}),
  };
}

/** What a stored decision says about itself, for the decision that re-checks it. */
export interface PreviousDecision {
  readonly band: string | null;
  readonly light: string | null;
  readonly card: Card;
  /** `peak.negative` as the engine worked it out (from the full trace). */
  readonly peak: number | null | undefined;
  /** Its cell's band before modifiers (from the full trace), for RC-1's "better cell". */
  readonly baseline: string | undefined;
}

/**
 * The re-check facts (Tab 8 step 11). "Support completed" needs the session records, which v2
 * cards don't open until the app moves to them (M8): left out until then, so RC-1's Blue waits.
 */
export function recheckFacts(p: PreviousDecision): EngineInput {
  const pathway = p.card.primary?.pathway;
  return {
    'recheck.present': true,
    ...(p.light ? { 'recheck.previous_light': p.light } : {}),
    ...(p.band ? { 'recheck.previous_band': p.band } : {}),
    ...(p.baseline ? { 'recheck.previous_baseline': p.baseline } : {}),
    ...(pathway ? { 'recheck.previous_pathway': pathway } : {}),
    ...(typeof p.peak === 'number' ? { 'recheck.previous_peak': p.peak } : {}),
  };
}

/** The last value a fact had in a full trace (the facts after each stage). */
export function lastFact(trace: unknown, name: string): unknown {
  const stages = (trace as { stages?: { facts: Record<string, unknown> }[] } | null)?.stages ?? [];
  for (let i = stages.length - 1; i >= 0; i -= 1) {
    const facts = stages[i]?.facts;
    if (facts && name in facts) return facts[name];
  }
  return undefined;
}

/**
 * SF-2 "days in a row at Very Constrained": consecutive days, ending today or yesterday, with a
 * Very Constrained card. Days are calendar days in the user's time zone.
 */
export function daysInRed(redDays: readonly Date[], now: Date, timeZone: string): number {
  const day = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone });
  const red = new Set(redDays.map(day));
  const cursor = new Date(now);
  if (!red.has(day(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (red.has(day(cursor)) && streak < 3650) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
