// Keyword rules for NUCRIPCE drivers and Tab 6 demand characteristics (suggestDrivers fallback).
// Urgency is never suggested: it comes from the timeline code only (Tab 5).

export type SuggestedDriver =
  'novelty' | 'challenge' | 'routine' | 'interest' | 'passion' | 'collaboration' | 'exploration';

const DRIVER_WORDS: readonly (readonly [SuggestedDriver, RegExp])[] = [
  [
    'routine',
    /\b(weekly|daily|usual|again|laundry|dishes|tidy|clean|bins|shopping|admin|timesheet|every)\b/,
  ],
  [
    'challenge',
    /\b(exam|hard|difficult|tough|test|interview|deadline|dissertation|presentation)\b/,
  ],
  ['novelty', /\b(new|first|never|start(ing)? a|unfamiliar|different)\b/],
  ['collaboration', /\b(team|group|together|with (my|the)|meeting|colleague|classmate|partner)\b/],
  ['exploration', /\b(research|explore|find out|look into|learn|read up|investigate)\b/],
  ['interest', /\b(fun|enjoy|love|hobby|game|music|interest)\b/],
  ['passion', /\b(project|creative|art|write|writing|design|build|portfolio)\b/],
];

const TRAIT_WORDS: readonly (readonly [string, RegExp])[] = [
  ['first_time', /\b(first|new|never)\b/],
  [
    'multi_step',
    /\b(report|essay|project|assignment|dissertation|application|plan|presentation|move house|portfolio)\b/,
  ],
  ['communication', /\b(email|call|message|reply|text|letter|ring|phone)\b/],
  ['with_others', /\b(team|group|meeting|together|with)\b/],
  ['research', /\b(research|find out|look into|read|sources)\b/],
  ['focus', /\b(essay|report|write|revise|revision|code|study|read)\b/],
  ['consequence', /\b(exam|deadline|bill|rent|tax|appointment|interview|due)\b/],
  ['done_before', /\b(weekly|again|usual|every|routine)\b/],
  ['ask_adjustment', /\b(adjustment|extension|accommodat|reasonable)\b/],
  ['event_prep', /\b(prepare|pack|get ready|before the)\b/],
];

export function suggestDriversByRules(title: string): {
  drivers: SuggestedDriver[];
  demandCharacteristics: string[];
} {
  const t = title.toLowerCase();
  return {
    drivers: DRIVER_WORDS.filter(([, re]) => re.test(t))
      .map(([d]) => d)
      .slice(0, 3),
    demandCharacteristics: TRAIT_WORDS.filter(([, re]) => re.test(t))
      .map(([c]) => c)
      .slice(0, 4),
  };
}
