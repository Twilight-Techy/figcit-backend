// Scoring for the speech eval (SYSTEM_DESIGN §4.3.8): word error rate and invented text. Pure.

/** Lower case, plain apostrophes, no punctuation: so only the words count. */
export function wordsOf(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[^a-z0-9' ]+/g, ' ')
      .match(/[a-z0-9']+/g) ?? []
  );
}

export interface Alignment {
  readonly substitutions: number;
  readonly deletions: number;
  readonly insertions: number;
  /** The longest run of words in the transcript that were never said. */
  readonly longestInsertion: number;
}

/** Word-level edit distance between what was said and what came back, with its edit counts. */
export function align(reference: readonly string[], hypothesis: readonly string[]): Alignment {
  const n = reference.length;
  const m = hypothesis.length;
  const width = m + 1;
  // cost[i * width + j]: edits to turn the first i words said into the first j words heard.
  const cost = new Int32Array((n + 1) * width);
  const at = (i: number, j: number): number => cost[i * width + j] ?? 0;
  const differ = (i: number, j: number): number => (reference[i - 1] === hypothesis[j - 1] ? 0 : 1);
  for (let i = 0; i <= n; i++) cost[i * width] = i;
  for (let j = 0; j <= m; j++) cost[j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      cost[i * width + j] = Math.min(
        at(i - 1, j - 1) + differ(i, j),
        at(i - 1, j) + 1,
        at(i, j - 1) + 1,
      );
  let i = n;
  let j = m;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let run = 0;
  let longestInsertion = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && at(i, j) === at(i - 1, j - 1) + differ(i, j)) {
      substitutions += differ(i, j);
      i--;
      j--;
      run = 0;
    } else if (j > 0 && at(i, j) === at(i, j - 1) + 1) {
      insertions++;
      run++;
      longestInsertion = Math.max(longestInsertion, run);
      j--;
    } else {
      deletions++;
      i--;
      run = 0;
    }
  }
  return { substitutions, deletions, insertions, longestInsertion };
}

/** Three or more words that were never said, or any words at all on a clip with no speech. */
export const INVENTED_RUN = 3;

export interface ClipResult {
  readonly id: string;
  readonly kind: 'speech' | 'silence';
  readonly room: 'quiet' | 'noisy';
  readonly accent?: string | undefined;
  readonly long: boolean;
  readonly referenceWords: number;
  readonly errors: number;
  readonly invented: boolean;
  readonly inventedWords: number;
  readonly latencyMs: number;
  readonly failed: boolean;
  readonly transcript: string;
}

export function scoreClip(
  clip: {
    id: string;
    kind: 'speech' | 'silence';
    room: 'quiet' | 'noisy';
    text: string;
    accent?: string | undefined;
    silenceSeconds?: number | undefined;
  },
  transcript: string,
  latencyMs: number,
  failed: boolean,
): ClipResult {
  const ref = wordsOf(clip.text);
  const hyp = wordsOf(transcript);
  const a = align(ref, hyp);
  const inventedWords = clip.kind === 'silence' ? hyp.length : a.insertions;
  return {
    id: clip.id,
    kind: clip.kind,
    room: clip.room,
    accent: clip.accent,
    long: clip.silenceSeconds !== undefined,
    referenceWords: ref.length,
    errors: a.substitutions + a.deletions + a.insertions,
    invented: clip.kind === 'silence' ? hyp.length > 0 : a.longestInsertion >= INVENTED_RUN,
    inventedWords,
    latencyMs,
    failed,
    transcript,
  };
}

/** Corpus word error rate: all errors over all words said, so long clips weigh more. */
export function wer(results: readonly ClipResult[]): number | null {
  const words = results.reduce((n, r) => n + r.referenceWords, 0);
  return words === 0 ? null : results.reduce((n, r) => n + r.errors, 0) / words;
}

export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1))] ??
    null
  );
}

export interface SpeechSummary {
  readonly clips: number;
  readonly wer: number | null;
  readonly werQuiet: number | null;
  readonly werNoisy: number | null;
  readonly werLongSilence: number | null;
  readonly werByAccent: Record<string, number | null>;
  readonly inventedClips: number;
  readonly inventedOnSilence: number;
  readonly failed: number;
  readonly latencyP50: number | null;
  readonly latencyP95: number | null;
}

export function summarise(results: readonly ClipResult[]): SpeechSummary {
  const speech = results.filter((r) => r.kind === 'speech');
  const accents = [...new Set(speech.map((r) => r.accent ?? 'unknown'))].sort();
  return {
    clips: results.length,
    wer: wer(speech),
    werQuiet: wer(speech.filter((r) => r.room === 'quiet')),
    werNoisy: wer(speech.filter((r) => r.room === 'noisy')),
    werLongSilence: wer(speech.filter((r) => r.long)),
    werByAccent: Object.fromEntries(
      accents.map((a) => [a, wer(speech.filter((r) => (r.accent ?? 'unknown') === a))]),
    ),
    inventedClips: results.filter((r) => r.invented).length,
    inventedOnSilence: results.filter((r) => r.kind === 'silence' && r.invented).length,
    failed: results.filter((r) => r.failed).length,
    latencyP50: percentile(
      results.map((r) => r.latencyMs),
      50,
    ),
    latencyP95: percentile(
      results.map((r) => r.latencyMs),
      95,
    ),
  };
}
