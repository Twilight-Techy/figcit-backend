// Free text → emotion chips with a confidence (Tab 11 layer 3). Below 0.7 the app asks "Is it more
// like X or Y?" instead of choosing; the user always confirms.
import type { Snapshot } from '@figcit/engine';
import { FEELING_WORDS } from './parse-need.js';

export interface FeelingMatch {
  readonly code: string;
  readonly confidence: number;
}

const EXACT = 0.9;
const SYNONYM = 0.75;
/** Hedged words ("a bit", "kind of") or two different readings make a match less certain. */
const HEDGE = /\b(a bit|kind of|sort of|maybe|i think|not sure|ish)\b/;

export function mapFeelingByRules(text: string, snapshot: Snapshot): { matches: FeelingMatch[] } {
  const t = text.toLowerCase();
  const synonyms = new Map(FEELING_WORDS);
  const found: FeelingMatch[] = [];
  for (const e of snapshot.emotions) {
    const label = e.label
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .trim();
    if (label && new RegExp(`\\b${label}\\b`).test(t))
      found.push({ code: e.code, confidence: EXACT });
    else if (synonyms.get(e.code)?.test(t)) found.push({ code: e.code, confidence: SYNONYM });
  }
  const families = new Set(
    found.map((f) => snapshot.emotions.find((e) => e.code === f.code)?.family),
  );
  const penalty = (HEDGE.test(t) ? 0.15 : 0) + (families.size > 1 ? 0.1 : 0);
  return {
    matches: found
      .map((f) => ({ ...f, confidence: Math.round((f.confidence - penalty) * 100) / 100 }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3),
  };
}
