// The speech eval set: what each clip says, and how it was recorded (SYSTEM_DESIGN §4.3.8).
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const clip = z.object({
  id: z.string().regex(/^sp-\d{3}$/),
  kind: z.enum(['speech', 'silence']),
  /** What was said, word for word; empty for a clip with no speech. */
  text: z.string(),
  voice: z.string().optional(),
  accent: z.string().optional(),
  room: z.enum(['quiet', 'noisy']),
  /** A pause this long in the middle of the sentence. */
  silenceSeconds: z.number().positive().optional(),
  /** Length of a clip with no speech. */
  seconds: z.number().positive().optional(),
});
const speechSet = z.object({
  version: z.number().int(),
  /** `synthetic` (TTS voices) until the team records it, then `recorded`. */
  status: z.enum(['synthetic', 'recorded']),
  clips: z.array(clip),
});

export type Clip = z.infer<typeof clip>;
export type SpeechSet = z.infer<typeof speechSet>;

export function loadSpeechSet(): SpeechSet {
  const set = speechSet.parse(
    JSON.parse(readFileSync(new URL('./set.json', import.meta.url), 'utf8')),
  );
  const ids = set.clips.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new Error('set.json: duplicate clip ids');
  for (const c of set.clips)
    if ((c.kind === 'speech') !== c.text.trim().length > 0)
      throw new Error(`set.json: ${c.id} needs text exactly when it has speech`);
  return set;
}
