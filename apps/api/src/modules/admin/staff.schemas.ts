import { z } from 'zod';
import { STAFF_ROLES } from '../../common/guards/auth.guard.js';

// Staff accounts (E-63): who is staff, with which roles; inviting, removing, suspending.

const role = z.enum(STAFF_ROLES);
const reason = z.string().trim().min(3).max(500).describe('Why (kept on the audit log)');

export const rolesSchema = z.object({ roles: z.array(role).max(5) }).strict();

export const inviteSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((e) => e.trim().toLowerCase()),
    roles: z.array(role).min(1).max(5),
    reason,
  })
  .strict();

export const reasonSchema = z.object({ reason }).strict();

export const handoverSchema = z
  .object({ userId: z.uuid().describe('An active admin with the two-step sign-in set up'), reason })
  .strict();

export const staffMemberSchema = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  roles: z.array(z.string()),
  status: z.enum(['active', 'suspended', 'deleted']),
  owner: z.boolean().describe('The Owner (E-64): the only one who gives Admin and Clinical admin'),
  mfa: z.boolean().describe('Has set up the two-step sign-in (false: invited, not yet signed in)'),
  lastActiveAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type StaffMember = z.infer<typeof staffMemberSchema>;

export const staffListSchema = z.object({ items: z.array(staffMemberSchema) });

export const inviteResultSchema = staffMemberSchema.extend({
  existing: z.boolean().describe('The email already had an account, which now has these roles'),
});
