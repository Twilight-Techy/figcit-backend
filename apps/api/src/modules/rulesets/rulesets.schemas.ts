import { MAPPING_STATUSES, TAB_KEYS } from '@figcit/engine-v2';
import { z } from 'zod';
import { GAP_KINDS } from './rule-gaps.service.js';

export const labelParam = z.string().regex(/^[0-9A-Za-z.]{1,16}-r\d{1,6}$/);
export const tabParam = z.enum(TAB_KEYS);
const reason = z.string().trim().min(3).max(500);
const cell = z
  .object({ col: z.number().int().min(0).max(60), text: z.string().max(20_000) })
  .strict();

/**
 * Nesting depth of a JSON value, counted without recursion so a hostile body can't exhaust the
 * stack. Stops counting at `max + 1`. O(n) in the value's size.
 */
export function withinDepth(value: unknown, max: number): boolean {
  const stack: [unknown, number][] = [[value, 0]];
  while (stack.length > 0) {
    const [item, depth] = stack.pop() ?? [null, 0];
    if (typeof item !== 'object' || item === null) continue;
    if (depth >= max) return false;
    for (const child of Object.values(item)) stack.push([child, depth + 1]);
  }
  return true;
}

// Engine columns are checked in full by @figcit/engine-v2 (E-36); here only their nesting is
// bounded. Conditions nest at most 6 deep, so 32 leaves room for the wrapping objects.
const engineValue = z
  .unknown()
  .refine((v) => withinDepth(v, 32), 'The engine columns are nested too deep.');

export const importBody = z
  .object({
    files: z.record(z.string().max(80), z.string().max(2_000_000)),
    workbookVersion: z
      .string()
      .regex(/^[0-9A-Za-z.]{1,16}$/)
      .default('3.3'),
    notes: z.string().max(500).optional(),
  })
  .strict();

export const draftBody = z
  .object({ from: labelParam.optional(), notes: z.string().max(500).optional() })
  .strict();

export const addRecordBody = z
  .object({
    after: z.uuid(),
    cells: z.array(cell).min(1).max(60),
    reason,
    safety: z.boolean().optional(),
  })
  .strict();

export const editRecordBody = z
  .object({
    cells: z.array(cell).min(1).max(60).optional(),
    mapping: z.enum(MAPPING_STATUSES).optional(),
    engine: engineValue.optional(),
    safety: z.boolean().optional(),
    workbookTag: z
      .string()
      .regex(/^v\d+(\.\d+)?$/)
      .nullable()
      .optional(),
    reason,
  })
  .strict();

export const reasonBody = z.object({ reason }).strict();

// Kept as data; bounded so a hostile body can't exhaust the stack.
const json = z.unknown().refine((v) => withinDepth(v, 16), 'Nested too deep.');

export const gapBody = z
  .object({
    title: z.string().trim().min(3).max(200),
    kind: z.enum(GAP_KINDS),
    detail: z.string().trim().min(3).max(10_000),
    recordIds: z.array(z.uuid()).min(1).max(50),
    exampleInput: json.optional(),
    whileExempt: z.string().max(2_000).optional(),
    recommendation: z.string().max(5_000).optional(),
    decides: z.enum(['founder', 'clinical_safety', 'owner']),
    docRef: z.string().max(120).optional(),
  })
  .strict();

export const gapUpdateBody = z
  .object({
    status: z.enum(['open', 'acknowledged', 'resolved']).optional(),
    resolution: z.string().max(5_000).optional(),
    whileExempt: z.string().max(2_000).optional(),
    recommendation: z.string().max(5_000).optional(),
    reason,
  })
  .strict();

export const gapsQuery = z
  .object({ status: z.enum(['open', 'acknowledged', 'resolved']).optional() })
  .strict();

export const decisionBody = z
  .object({
    code: z.string().trim().min(2).max(40),
    title: z.string().trim().min(3).max(200),
    detail: z.string().trim().min(3).max(10_000),
    source: z.string().trim().min(2).max(200),
    decidedBy: z.string().trim().min(2).max(120),
    decidedAt: z.iso.date(),
    gapIds: z.array(z.uuid()).max(50).default([]),
  })
  .strict();

export const auditQuery = z
  .object({
    versionId: z.uuid().optional(),
    recordId: z.uuid().optional(),
    before: z
      .string()
      .regex(/^\d{1,18}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();
