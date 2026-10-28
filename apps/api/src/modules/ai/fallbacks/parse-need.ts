// Keyword fallback for "in your own words" (S91). Conservative: when unsure, the need list shows.
import type { Snapshot } from '@figcit/engine';

export type TaskType = 'study' | 'work' | 'health' | 'social' | 'home_other';

export interface ParsedNeed {
  readonly needs: string[];
  readonly heard: { label: string; kind: 'feeling' | 'setting' | 'task' | 'need' }[];
  readonly task: { title: string; type: TaskType } | null;
  readonly supportOnly: boolean;
}

const NEED_WORDS: readonly (readonly [string, RegExp])[] = [
  ['urgent_help', /\b(can'?t cope|in crisis|emergency)\b/],
  [
    'clear_head',
    /\b(too much in my head|so much going on|brain dump|everything at once|can'?t think|head is full|racing thoughts?)\b/,
  ],
  [
    'feel_calmer',
    /\b(calm(er)?|panick?(ing|y)?|anxious|overwhelmed|on edge|stressed|wound up|breathe)\b/,
  ],
  [
    'find_words',
    /\b(say|word(s|ing)?|email|message|reply|text (him|her|them)|tell (him|her|them|my))\b/,
  ],
  ['get_started', /\b(start(ed)?|get going|procrastinat|putting (it )?off|can'?t begin|motivat)\b/],
  ['break_down', /\b(break (it )?down|too big|where to begin|steps?|so many parts)\b/],
  ['decide_first', /\b(decide|choose|which (one|first)|prioriti[sz]e|what first)\b/],
  ['stop_switch', /\b(stop|switch|move on|transition|hyperfocus|can'?t put (it )?down)\b/],
  ['rest', /\b(rest|tired|exhausted|sleep|burn(ed|t)? out|drained|wiped)\b/],
  ['someone_to_talk', /\b(talk to someone|lonely|alone|need a friend|someone to talk)\b/],
  ['ask_help', /\b(ask for help|need help from|ask (my|the) (tutor|manager|teacher|boss))\b/],
  ['speak_up', /\b(speak up|stand up for|say no|boundar(y|ies)|adjustment)\b/],
  ['make_sense', /\b(make sense|understand (why|what)|figure out|confus(ed|ing))\b/],
  ['find_stillness', /\b(still(ness)?|quiet|peace|meditat)\b/],
  ['pray_practice', /\b(pray(er)?|ritual|recit|dhikr|rosary)\b/],
  [
    'prepare_event',
    /\b(prepare|before the|upcoming|interview|presentation|appointment|party tonight)\b/,
  ],
  ['recover_event', /\b(after the|recover|peopled out|social hangover|that was a lot)\b/],
  ['change_how', /\b(change how|do it differently|adapt|different way)\b/],
  ['grateful', /\b(grateful|thankful|gratitude)\b/],
  ['feel_connected', /\b(connected|reach out|miss (them|my))\b/],
  ['start_end_day', /\b(start (my|the) day|end (of )?(my|the) day|wind down|morning routine)\b/],
];

const SUPPORT_ONLY =
  /\b(just (want|need) to (talk|vent|be heard)|just listen|don'?t want (advice|to do anything))\b/;
const TASK_RE =
  /\b(?:need to|have to|got to|gotta|must|should|supposed to|trying to)\s+([a-z][^,.!?;]{2,60})/i;

const TYPE_WORDS: readonly (readonly [TaskType, RegExp])[] = [
  [
    'study',
    /\b(essay|assignment|exam|revis|homework|lecture|dissertation|study|coursework|uni|school)\b/,
  ],
  [
    'work',
    /\b(report|meeting|email|manager|boss|client|deadline|shift|work|presentation|slides)\b/,
  ],
  ['health', /\b(doctor|gp|appointment|medication|prescription|dentist|exercise|therapy)\b/],
  ['social', /\b(friend|party|text|call (my|him|her)|birthday|family|date)\b/],
];

function taskType(title: string): TaskType {
  return TYPE_WORDS.find(([, re]) => re.test(title))?.[0] ?? 'home_other';
}

function feelingAndSettingChips(t: string, snapshot: Snapshot): ParsedNeed['heard'] {
  const heard: ParsedNeed['heard'] = [];
  for (const e of snapshot.emotions) {
    if (heard.length >= 3) break;
    const label = e.label.toLowerCase().replace(/[^a-z ]/g, '');
    if (new RegExp(`\\b${label}\\b`).test(t))
      heard.push({ label: e.label.slice(0, 24), kind: 'feeling' });
  }
  for (const env of snapshot.environments) {
    const label = env.label.split(/[ /]/)[0]?.toLowerCase() ?? '';
    if (label.length <= 3 || heard.length >= 4) continue;
    if (new RegExp(`\\b(at|in|on) (the |my )?${label}\\b`).test(t))
      heard.push({ label: env.label.slice(0, 24), kind: 'setting' });
  }
  return heard;
}

function taskFrom(text: string): ParsedNeed['task'] {
  const title = TASK_RE.exec(text)?.[1]
    ?.trim()
    .replace(/\s+(but|and|so)\s.*$/i, '');
  return title
    ? { title: title.charAt(0).toUpperCase() + title.slice(1), type: taskType(title.toLowerCase()) }
    : null;
}

export function parseNeedByRules(text: string, snapshot: Snapshot): ParsedNeed {
  const t = text.toLowerCase();
  const known = new Set(snapshot.needs.map((n) => n.code));
  const needs = NEED_WORDS.filter(([code, re]) => known.has(code) && re.test(t))
    .map(([code]) => code)
    .slice(0, 2);
  const task = taskFrom(text);
  const labels = new Map(snapshot.needs.map((n) => [n.code, n.label]));
  const heard = [
    ...feelingAndSettingChips(t, snapshot),
    ...(task ? [{ label: task.title.slice(0, 24), kind: 'task' as const }] : []),
    ...needs.map((code) => ({
      label: (labels.get(code) ?? code).slice(0, 24),
      kind: 'need' as const,
    })),
  ].slice(0, 5);
  return { needs, heard, task, supportOnly: SUPPORT_ONLY.test(t) };
}
