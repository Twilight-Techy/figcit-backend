import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { exampleFor } from './example.js';

const example = (schema: z.ZodType): unknown =>
  exampleFor(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }));

describe('exampleFor', () => {
  it('builds an example its own schema accepts', () => {
    const schema = z
      .object({
        id: z.uuid(),
        at: z.iso.datetime(),
        email: z.email(),
        kind: z.enum(['study', 'work']),
        steps: z.array(z.string().min(1).max(80)).min(2),
        count: z.number().int().min(0).max(10),
        code: z.string().regex(/^\d{6}$/),
        note: z.string().nullable(),
        nested: z.object({ on: z.boolean() }),
      })
      .strict();
    expect(schema.safeParse(example(schema)).success).toBe(true);
  });

  it('prefers defaults and keeps integers small and in range', () => {
    expect(example(z.object({ size: z.number().int(), cap: z.number().int().max(-2) }))).toEqual({
      size: 1,
      cap: -2,
    });
    expect(example(z.object({ mode: z.string().default('gentle') }))).toEqual({ mode: 'gentle' });
  });

  it('uses only made-up values', () => {
    const json = JSON.stringify(example(z.object({ email: z.email(), url: z.url() })));
    expect(json).toContain('example.test');
  });
});
