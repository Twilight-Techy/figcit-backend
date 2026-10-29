// Fill-in templates for draft, structure and script (Express fallbacks; Figma S22, S114, S116).

export interface Section {
  readonly role: 'ask' | 'why' | 'offer' | 'close' | 'other';
  readonly text: string;
}
export interface ScriptLine {
  readonly cue: 'you' | 'if_asked_why' | 'if_none_free' | 'to_end' | 'other';
  readonly text: string;
}

/** Notes as sentences: one per line or sentence, capitalised and ending in a full stop. */
function sentences(notes: string): string[] {
  return notes
    .split(/\n+|(?<=[.!?])\s+/)
    .map((p) => p.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean)
    .map((p) => {
      const cap = p.charAt(0).toUpperCase() + p.slice(1);
      return /[.!?]$/.test(cap) ? cap : `${cap}.`;
    });
}

export function draftByTemplate(notes: string, purpose: string | undefined): string {
  const [ask, ...context] = sentences(notes);
  const to = purpose?.trim() ? ` ${purpose.trim().replace(/^(my|the)\s+/i, '')}` : '';
  const body = [
    ask ?? 'I wanted to ask about something.',
    ...(context.length ? [context.join(' ')] : []),
  ];
  return `Hi${to},\n\n${body.join('\n\n')}\n\nWould that be possible? Let me know if you need anything else from me.\n\nThanks,`;
}

export function structureByTemplate(notes: string): { sections: Section[] } {
  const [ask, ...rest] = sentences(notes);
  return {
    sections: [
      { role: 'ask', text: ask ?? 'What I need: ' },
      { role: 'why', text: rest.length ? rest.join(' ') : 'Why it matters: ' },
      { role: 'offer', text: 'What I can do: ' },
      { role: 'close', text: 'Thanks for reading. Let me know what works.' },
    ],
  };
}

export function scriptByTemplate(notes: string): { lines: ScriptLine[] } {
  const [ask, ...rest] = sentences(notes);
  return {
    lines: [
      { cue: 'you', text: ask ?? 'I wanted to ask you about something.' },
      {
        cue: 'if_asked_why',
        text: rest.length ? rest.join(' ') : 'It would really help me get it done well.',
      },
      { cue: 'if_none_free', text: "That's okay. Could we find another time that works?" },
      { cue: 'to_end', text: 'Thanks, I appreciate it.' },
    ],
  };
}
