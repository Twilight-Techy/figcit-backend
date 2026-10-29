// One sentence with several things to do → separate tasks (Tab 11 layer 6). Only the user's own
// words are used, and the user confirms the split.

const VERB =
  /^(call|email|text|reply|message|write|finish|start|send|book|pay|buy|clean|tidy|fix|ask|tell|read|revise|study|submit|check|sort|make|cook|wash|plan|prepare|practise|practice|review|update|order|pick up|go|get|do|apply|print|post|ring|meet|see|visit)\b/i;
const SEPARATORS =
  /\s*(?:\n|;|\.\s|,\s*(?:and\s+)?then\s+|\s+and\s+then\s+|\s+then\s+|,\s+and\s+|\s+and\s+|,\s+)\s*/i;
const MAX = 5;

const tidy = (s: string): string => {
  const t = s
    .trim()
    .replace(/^(i\s+)?(need|have|got)\s+to\s+/i, '')
    .replace(/[.!?,;]+$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Splits only where every part reads as its own task (starts with a doing word). */
export function splitTasksByRules(text: string): { tasks: string[] } {
  const parts = text
    .split(SEPARATORS)
    .map(tidy)
    .filter((p) => p.length >= 3);
  if (parts.length < 2 || !parts.every((p) => VERB.test(p))) return { tasks: [tidy(text)] };
  return { tasks: parts.slice(0, MAX) };
}
