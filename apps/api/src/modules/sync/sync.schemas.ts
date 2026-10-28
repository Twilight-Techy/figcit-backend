import { z } from 'zod';

export const syncOperationSchema = z
  .object({
    id: z.uuid(),
    entity: z.enum([
      'check_in',
      'task',
      'task_steps',
      'session',
      'feedback',
      'dump',
      'reflection',
      'draft',
      'practice',
      'reminder',
      'support_plan',
      'safety_event',
    ]),
    op: z.enum(['create', 'update', 'delete']),
    entityId: z.uuid(),
    data: z.record(z.string(), z.unknown()).default({}),
    clientUpdatedAt: z.iso.datetime(),
  })
  .strict();
export const syncPushSchema = z
  .object({ operations: z.array(syncOperationSchema).min(1).max(100) })
  .strict();
export const syncResultSchema = z.object({
  id: z.uuid(),
  result: z.enum(['applied', 'duplicate', 'rejected']),
  entityId: z.uuid(),
  error: z.string().nullable(),
});
export const syncPushResultSchema = z.object({ results: z.array(syncResultSchema) });
export const syncPullQuerySchema = z.object({ since: z.iso.datetime() }).strict();
export const syncPullSchema = z.object({
  cursor: z.iso.datetime(),
  changes: z.record(
    z.string(),
    z.array(z.object({ id: z.uuid(), updatedAt: z.iso.datetime(), deleted: z.boolean() })),
  ),
});
