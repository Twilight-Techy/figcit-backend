// The recovery command (E-64): makes an account the staff app's Owner, when the Owner can't hand
// over (lost their authenticator, left, unreachable). Run on the server, with database access:
//   pnpm --filter @figcit/api staff:owner -- --email someone@example.com --reason "why"
// or, from a build: node --env-file=../../.env dist/cli/staff-owner.js --email … --reason …
// It is on the audit log as staff.owner.recover. It is not in the app, so a stolen admin account
// can't use it.
import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { setOwner } from '../modules/admin/owner.service.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, reason: { type: 'string' } },
});
const email = values.email?.trim().toLowerCase();
const reason = values.reason?.trim() ?? '';
if (!email || reason.length < 3) {
  console.error('Usage: staff:owner -- --email <email> --reason "<why, 3+ characters>"');
  process.exit(2);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.status !== 'active') {
    console.error(`No active account for ${email}: invite them first, then run this again.`);
    process.exitCode = 1;
  } else {
    await prisma.$transaction((tx) =>
      setOwner(tx, user.id, {
        actorId: null,
        actorRole: 'system',
        action: 'staff.owner.recover',
        reason,
      }),
    );
    console.log(`${email} is now the Owner (on the audit log as staff.owner.recover).`);
  }
} finally {
  await prisma.$disconnect();
}
