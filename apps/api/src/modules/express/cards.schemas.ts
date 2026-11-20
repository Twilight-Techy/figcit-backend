import { z } from 'zod';

// Communication cards the person wrote (S117), beside the app's own set.

/** Most cards one person keeps: enough for every situation, few enough to scroll. */
export const MAX_OWN_CARDS = 50;

const text = z
  .string()
  .trim()
  .min(1)
  .max(140)
  .describe('What the card says, shown big; checked for safety by the app first');

export const commCardSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  createdAt: z.iso.datetime(),
});
export type CommCardDto = z.infer<typeof commCardSchema>;

export const commCardListSchema = z.object({
  items: z.array(commCardSchema).describe('Oldest first, as they were added'),
});

export const commCardInputSchema = z.object({ text }).strict();
export type CommCardInput = z.infer<typeof commCardInputSchema>;
