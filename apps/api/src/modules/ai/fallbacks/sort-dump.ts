// Keyword bucket suggestions for a dump (sortDump fallback). Worries never become tasks (S103).

export type Bucket = 'ideas' | 'notes' | 'worries' | 'todo';

const WORRY =
  /\b(worr(y|ied|ying)|what if|scared|afraid|anxious|nervous|dread|can'?t stop thinking|panic)\b/i;
const TODO =
  /^(call|email|buy|book|pay|send|reply|finish|start|write|clean|text|ring|pick up|sort|fix|ask|tell|check|submit|order|make|do)\b|\b(need to|have to|remember to|don'?t forget|must|todo|to do)\b/i;
const IDEA =
  /\b(idea|maybe|what about|could (try|do)|might|wonder if|imagine|would be (cool|nice|fun))\b/i;

export function bucketFor(text: string): Bucket {
  if (WORRY.test(text)) return 'worries';
  if (TODO.test(text.trim())) return 'todo';
  if (IDEA.test(text)) return 'ideas';
  return 'notes';
}

export function sortDumpByRules(items: readonly { id: string; text: string }[]): {
  items: { id: string; bucket: Bucket }[];
} {
  return { items: items.map((i) => ({ id: i.id, bucket: bucketFor(i.text) })) };
}
