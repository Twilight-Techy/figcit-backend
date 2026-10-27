// Fill-in templates for draft, structure and script (Express fallbacks; Figma S22, S114, S116).

export interface Section {
  readonly role: 'ask' | 'why' | 'offer' | 'close' | 'other';
  readonly text: string;
}
export interface ScriptLine {
  readonly cue: 'you' | 'if_asked_why' | 'if_none_free' | 'to_end' | 'other';
  readonly text: string;
}

function firstSentence(text: string): string {
  return (text.split(/(?<=[.!?])\s+/)[0] ?? text).trim();
}

export function draftByTemplate(notes: string, purpose: string | undefined): string {
  const ask = firstSentence(notes) || 'I wanted to ask about something.';
  const greeting =
    purpose && /\b(tutor|teacher|lecturer|manager|boss)\b/i.test(purpose) ? 'Hi,' : 'Hi,';
  return `${greeting}\n\n${ask}\n\nWould that be possible? Let me know if you need anything else from me.\n\nThanks,`;
}

export function structureByTemplate(notes: string): { sections: Section[] } {
  const parts = notes
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    sections: [
      { role: 'ask', text: parts[0] ?? 'What I need: ' },
      { role: 'why', text: parts[1] ?? 'Why it matters: ' },
      { role: 'offer', text: parts[2] ?? 'What I can do: ' },
      { role: 'close', text: 'Thanks for reading. Let me know what works.' },
    ],
  };
}

export function scriptByTemplate(notes: string): { lines: ScriptLine[] } {
  const ask = firstSentence(notes) || 'I wanted to ask you about something.';
  return {
    lines: [
      { cue: 'you', text: ask },
      { cue: 'if_asked_why', text: 'It would really help me get it done well.' },
      { cue: 'if_none_free', text: "That's okay. Could we find another time that works?" },
      { cue: 'to_end', text: 'Thanks, I appreciate it.' },
    ],
  };
}
