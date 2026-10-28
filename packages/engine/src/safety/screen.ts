import type { SafetyPhraseGroup } from '../types.js';
import { PhraseMatcher } from './aho-corasick.js';
import { normalise } from './normalize.js';

export interface SafetyScreen {
  /** Returns the first risk match in any of the texts, or null. */
  check(texts: readonly string[]): { readonly ruleId: string; readonly category: string } | null;
}

export function buildSafetyScreen(
  groups: readonly SafetyPhraseGroup[],
  exclusions: readonly string[],
): SafetyScreen {
  const phrases: string[] = [];
  const owner: { ruleId: string; category: string }[] = [];
  for (const group of groups) {
    for (const phrase of group.phrases) {
      const normal = normalise(phrase);
      if (!normal) continue;
      phrases.push(normal);
      owner.push({ ruleId: group.id, category: group.category });
    }
  }
  const matcher = new PhraseMatcher(phrases);
  const excluder = new PhraseMatcher(exclusions.map(normalise).filter(Boolean));

  return {
    check(texts) {
      for (const text of texts) {
        const normal = normalise(text);
        if (!normal) continue;
        // Blank out excluded spans ("killed it") before looking for risk phrases.
        const chars = normal.split('');
        for (const m of excluder.match(normal))
          for (let i = m.start; i < m.end; i += 1) chars[i] = ' ';
        const cleaned = chars.join('');
        const hit = matcher.match(cleaned)[0];
        if (hit) return owner[hit.phrase] ?? null;
      }
      return null;
    },
  };
}
