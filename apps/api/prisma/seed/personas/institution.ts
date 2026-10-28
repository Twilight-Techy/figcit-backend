// Northbridge University: a tenant with enough sharing members that trends clear the anonymity floor.
import { ConsentService } from '../../../src/modules/consent/consent.service.js';
import { InstitutionsService } from '../../../src/modules/institutions/institutions.service.js';
import { pick, rng, type CheckInKey } from './data.js';
import { DAY, type Seeder } from './seeder.js';

const MEMBERS = 60;
const FLOOR = 20;

export async function seedInstitution(
  s: Seeder,
  domain: string,
): Promise<{ tenantId: string; code: string }> {
  const tenant = await s.prisma.tenant.create({
    data: {
      name: 'Northbridge University',
      slug: 'demo-northbridge',
      kind: 'university',
      anonymityFloor: FLOOR,
      seatsPlanCode: 'institution',
    },
  });
  const code = 'NORTH2026';
  await s.prisma.inviteCode.create({
    data: { code, tenantId: tenant.id, maxUses: 500, expiresAt: new Date(Date.now() + 365 * DAY) },
  });
  const institutions = s.get(InstitutionsService);
  const lead = await s.user(`lead@${domain}`, { nickname: 'Dr. Okafor (support lead)' });
  await institutions.join(lead, code);
  await s.prisma.tenantMembership.update({
    where: { tenantId_userId: { tenantId: tenant.id, userId: lead } },
    data: { role: 'support_lead' },
  });

  const r = rng(42);
  const keys: CheckInKey[] = ['green', 'yellow', 'amber', 'calm', 'stuck', 'red', 'words'];
  for (let i = 1; i <= MEMBERS; i += 1) {
    const name = `student${String(i).padStart(2, '0')}`;
    const id = await s.user(`${name}@${domain}`, {
      nickname: name === 'student01' ? 'Dee' : `Student ${String(i)}`,
      consents: ['wellbeing_data', 'personalisation', 'institution_sharing'],
      createdDaysAgo: 40,
    });
    await institutions.join(id, code);
    for (let w = 0; w < 4; w += 1) {
      const day = w * 7 + 1 + Math.floor(r() * 5);
      const when = new Date(Date.now() - day * DAY);
      when.setUTCHours(10 + Math.floor(r() * 8));
      await s.checkIn(id, pick(r, keys), when);
    }
  }
  // One member who did not turn sharing on is never counted.
  const quiet = await s.user(`private-student@${domain}`, { nickname: 'Private student' });
  await institutions.join(quiet, code);
  await s
    .get(ConsentService)
    .record(quiet, [{ purpose: 'institution_sharing', granted: false }], 'settings');
  const dee = await s.prisma.user.findUniqueOrThrow({
    where: { email: `student01@${domain}` },
    select: { id: true },
  });
  await institutions.outreach(
    dee.id,
    'Exams are piling up and I am struggling to keep up. Could someone check in with me?',
    'email',
  );
  await institutions.aggregate();
  return { tenantId: tenant.id, code };
}
