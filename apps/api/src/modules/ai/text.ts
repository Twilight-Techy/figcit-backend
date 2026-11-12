// Pure text rules shared by the AI tasks and their fallbacks (SYSTEM_DESIGN §4.3.3).

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const PHONE = /\+?\d[\d ()-]{7,}\d/g;

/** Strips emails, phone numbers and links and caps the length before text reaches the model. */
export function scrub(text: string, max: number): string {
  return text
    .replace(EMAIL, '[email]')
    .replace(URL_RE, '[link]')
    .replace(PHONE, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Never in anything we show: diagnosis, false reassurance or blame (content rules). */
export const BANNED = [
  'you should have',
  'finally',
  'just calm down',
  'everything will be fine',
  'you are fine',
  "don't worry",
  'diagnos',
  'disorder',
  'lazy',
  'no excuse',
  'stop overreacting',
];

export function hasBanned(text: string): boolean {
  const t = text.toLowerCase();
  return BANNED.some((b) => t.includes(b));
}

/**
 * An answer that talks to the writer instead of being their message (owner review, 12 Nov 2026):
 * it agrees to help, presents "your message", or reacts to what they wrote. Such a reply means the
 * model followed or answered the notes; the rule-based result is used instead.
 */
const TALKS_TO_WRITER = [
  /^(sure|of course|certainly|absolutely|okay|ok|great|no problem)\b[!,.]/i,
  /^(here('s| is| are)|below is)\b/i,
  /^(i('d| would) (be )?(happy|glad|love) to|i can help|i('ll| will) help|let me help)\b/i,
  /^(as an ai|i('m| am) (an ai|a language model|sorry,? but i))/i,
  /^(it sounds like|that sounds|thank you for sharing|thanks for sharing)\b/i,
  /\byour (message|draft|notes|text)\b/i,
  /\b(rewritten|reworded|simplified) (version|message)\b/i,
];

export function talksToWriter(text: string): boolean {
  const t = text.trim();
  return TALKS_TO_WRITER.some((r) => r.test(t));
}

/** Hedging and apology phrases removed by simplify, longest first (Figma S115 "What we changed"). */
export const HEDGES = [
  "i completely understand if this isn't possible at all",
  "i understand if this isn't possible",
  'i am so sorry to bother you',
  "i'm so sorry to bother you",
  'sorry to bother you',
  "i'm really sorry",
  'i am really sorry',
  'i am so sorry',
  'i am sorry',
  'whether there might perhaps be any chance of',
  'whether there might be any chance of',
  'i was wondering whether',
  "i'm so sorry",
  "i'm sorry",
  'sorry for the trouble',
  'sorry if this is',
  'apologies for',
  'i was just wondering if',
  'i was wondering if',
  'i just wanted to',
  'i hope this is okay',
  'i hope this is ok',
  'if that is okay',
  "if that's okay",
  "if it's not too much trouble",
  'no worries if not',
  'i know you are busy',
  "i know you're busy",
  'i might be wrong but',
  'this might be a silly question',
  'sorry',
  'just',
  'basically',
  'actually',
  'kind of',
  'sort of',
  'perhaps',
  'maybe',
];

export function words(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export interface Changes {
  readonly wordsBefore: number;
  readonly wordsAfter: number;
  readonly removedPhrases: number;
  readonly summary: string;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countHedges(text: string): number {
  const t = ` ${text.toLowerCase()} `;
  let n = 0;
  let rest = t;
  for (const h of HEDGES) {
    const re = new RegExp(`(^|[^a-z'])${escape(h)}(?=[^a-z']|$)`, 'g');
    const found = rest.match(re)?.length ?? 0;
    n += found;
    rest = rest.replace(re, ' ');
  }
  return n;
}

/** Worked out by rules, not AI: word counts and how many hedges were removed. */
export function changes(before: string, after: string): Changes {
  const removed = Math.max(0, countHedges(before) - countHedges(after));
  const wb = words(before);
  const wa = words(after);
  const parts = [
    removed
      ? `Removed ${String(removed)} apologetic or filler phrase${removed === 1 ? '' : 's'}`
      : '',
    `${String(wb)} → ${String(wa)} words`,
  ].filter(Boolean);
  return { wordsBefore: wb, wordsAfter: wa, removedPhrases: removed, summary: parts.join(' · ') };
}

function tidy(text: string): string {
  return text
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,.!?]){2,}/g, '$1')
    .replace(/(^|[.!?]\s+)[,\s]+/g, '$1')
    .replace(/ {2,}/g, ' ')
    .replace(/(^|[.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    .trim();
}

function removeHedges(text: string): string {
  let out = ` ${text} `;
  for (const h of HEDGES)
    out = out.replace(new RegExp(`(^|[^A-Za-z'])${escape(h)}(?=[^A-Za-z']|$)`, 'gi'), '$1');
  return tidy(out);
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Rule-based simplify: the fallback when the model is unavailable, and never longer than the input. */
export function simplifyByRules(text: string, level: 'gentle' | 'clear' | 'shortest'): string {
  const cleaned = removeHedges(text);
  if (level === 'gentle') return cleaned || text;
  const kept = sentences(cleaned).filter((s) => words(s) > 1);
  if (level === 'clear') return kept.join(' ') || cleaned || text;
  // Shortest: the sentence that asks for something, else the first one.
  const ask = kept.find((s) => /\?|\b(can|could|would|please|need|let me know)\b/i.test(s));
  return ask ?? kept[0] ?? (cleaned || text);
}

const NUMBER_OR_DATE = /\b\d[\d:/.-]*\b/g;
const NAME = /\b[A-Z][a-z]{2,}\b/g;

/** No new names, dates or numbers the user didn't write (simplify check). */
export function introducesFacts(input: string, output: string): boolean {
  const have = new Set([
    ...(input.match(NUMBER_OR_DATE) ?? []),
    ...(input.match(NAME) ?? []).map((n) => n.toLowerCase()),
  ]);
  // A sentence's first word is capitalised anyway; compare it without its punctuation ("Sorry,").
  const firstWords = new Set(
    sentences(output).map((s) =>
      s
        .split(/\s+/)[0]
        ?.toLowerCase()
        .replace(/[^a-z']/g, ''),
    ),
  );
  const nums = output.match(NUMBER_OR_DATE) ?? [];
  const names = (output.match(NAME) ?? [])
    .map((n) => n.toLowerCase())
    .filter((n) => !firstWords.has(n) && !COMMON.has(n));
  return nums.some((n) => !have.has(n)) || names.some((n) => !have.has(n));
}

const COMMON = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'thanks',
  'thank',
  'hello',
  'dear',
  'please',
  'best',
  'kind',
  'regards',
  'could',
  'would',
  'can',
  'the',
  'this',
  'that',
]);
