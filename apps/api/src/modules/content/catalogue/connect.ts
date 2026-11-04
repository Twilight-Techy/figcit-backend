// Connect message starters (S118) and contact relationships (S119). Sending is always handed to the phone (D-20).

export interface Starter {
  readonly code: string;
  readonly text: string;
  readonly kind: 'ask' | 'checkin' | 'quiet' | 'boundary';
}

export const STARTERS: readonly Starter[] = [
  { code: 'text_later', text: 'Rough day — could you text me later? 💜', kind: 'ask' },
  { code: 'sit_quietly', text: 'Can we sit together quietly for a bit?', kind: 'quiet' },
  { code: 'no_reply', text: 'Just checking in. No reply needed.', kind: 'checkin' },
  { code: 'call_me', text: 'Could you call me when you are free?', kind: 'ask' },
  {
    code: 'need_quiet',
    text: 'I need some quiet for a little while. Nothing is wrong, I just need space.',
    kind: 'quiet',
  },
  {
    code: 'not_up_to_talking',
    text: "I'm not up to talking right now, but I'd like company. Could you stay nearby?",
    kind: 'quiet',
  },
  {
    code: 'running_late',
    text: "I'm running behind today. I'll be in touch when I can.",
    kind: 'boundary',
  },
  {
    code: 'cant_make_it',
    text: "I can't make it today. Can we find another time?",
    kind: 'boundary',
  },
  { code: 'hard_time', text: "I'm having a hard time. Could you check on me?", kind: 'ask' },
];

export const RELATIONSHIPS = ['friend', 'family', 'partner', 'study_buddy'] as const;

/** Links that open the phone's own apps with the message ready. Nothing is sent by NUCCESS. */
export function sendLinks(
  text: string,
  phone: string | null,
  email: string | null,
): { sms: string | null; whatsapp: string | null; email: string | null; share: string } {
  const enc = encodeURIComponent(text);
  const digits = phone?.replace(/[^\d+]/g, '') ?? null;
  return {
    sms: digits ? `sms:${digits}?&body=${enc}` : null,
    whatsapp: digits ? `https://wa.me/${digits.replace(/^\+/, '')}?text=${enc}` : null,
    email: email ? `mailto:${email}?body=${enc}` : null,
    share: text,
  };
}
