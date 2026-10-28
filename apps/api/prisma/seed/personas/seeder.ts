// Helpers that create persona data through the real services, then move timestamps into the past.
import type { INestApplicationContext } from '@nestjs/common';
import argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import { CryptoService } from '../../../src/common/crypto/crypto.service.js';
import { PrismaService } from '../../../src/common/db/prisma.service.js';
import { checkInInputSchema } from '../../../src/modules/checkin/checkin.schemas.js';
import { CheckInService } from '../../../src/modules/checkin/checkin.service.js';
import { ConsentService } from '../../../src/modules/consent/consent.service.js';
import { SessionsService } from '../../../src/modules/sessions/sessions.service.js';
import { UsersRepository } from '../../../src/modules/users/users.repository.js';
import { UsersService } from '../../../src/modules/users/users.service.js';
import { CHECKINS, type CheckInKey } from './data.js';

export const DAY = 86_400_000;
export const DEMO_PASSWORD = 'Nuccess-demo-2026!';
/** Authenticator secret shared by every seeded staff account (base32). Demo data only. */
export const STAFF_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

export interface PersonaOptions {
  readonly nickname: string;
  readonly timezone?: string;
  readonly region?: string;
  readonly roles?: readonly string[];
  readonly createdDaysAgo?: number;
  readonly consents?: readonly (
    'wellbeing_data' | 'personalisation' | 'analytics' | 'research' | 'institution_sharing'
  )[];
  readonly preferences?: Record<string, unknown>;
  readonly helpWith?: readonly string[];
}

export class Seeder {
  readonly prisma: PrismaService;
  private passwordHash: string | undefined;
  /** Demand title → task, per user, so a repeated demand reuses its task like the app does. */
  private readonly demandTasks = new Map<string, string>();

  constructor(readonly app: INestApplicationContext) {
    this.prisma = app.get(PrismaService);
  }

  get<T>(type: new (...args: never[]) => T): T {
    return this.app.get(type, { strict: false });
  }

  /** Removes earlier persona data: only accounts on the reserved test domain. */
  async wipe(domain: string): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { email: { endsWith: `@${domain}` } },
      select: { id: true },
    });
    for (const u of users) {
      await this.prisma.purge(async (tx) => {
        await tx.safetyEvent.deleteMany({ where: { userId: u.id } });
        await tx.consent.deleteMany({ where: { userId: u.id } });
        await tx.auditEvent.deleteMany({ where: { actorId: u.id } });
        await tx.user.delete({ where: { id: u.id } });
      });
    }
    await this.prisma.tenant.deleteMany({ where: { slug: { startsWith: 'demo-' } } });
    return users.length;
  }

  async user(email: string, o: PersonaOptions): Promise<string> {
    this.passwordHash ??= await argon2.hash(DEMO_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const crypto = this.get(CryptoService);
    const { id } = await this.get(UsersRepository).create({
      email,
      dataKeyEnc: crypto.newWrappedKey(),
      emailVerified: true,
      passwordHash: this.passwordHash,
    });
    const users = this.get(UsersService);
    await users.update(id, {
      nickname: o.nickname,
      timezone: o.timezone ?? 'Europe/London',
      region: o.region ?? 'GB',
      helpWith: [...(o.helpWith ?? ['focus', 'overwhelm'])],
      journeySeen: true,
      setupDone: true,
    });
    await users.confirmAge(id);
    if (o.preferences) await users.updatePreferences(id, o.preferences);
    const consents = o.consents ?? ['wellbeing_data', 'personalisation'];
    await this.get(ConsentService).record(
      id,
      consents.map((purpose) => ({ purpose, granted: true })),
      'onboarding',
    );
    const createdAt = new Date(Date.now() - (o.createdDaysAgo ?? 60) * DAY);
    await this.prisma.user.update({
      where: { id },
      data: { createdAt, ...(o.roles ? { roles: ['customer', ...o.roles] as never } : {}) },
    });
    if (o.roles?.length) {
      const cipher = await crypto.forUser(id);
      await this.prisma.mfaFactor.create({
        data: { userId: id, secretEnc: cipher.enc(STAFF_TOTP_SECRET), confirmedAt: new Date() },
      });
    }
    return id;
  }

  async checkIn(
    userId: string,
    key: CheckInKey,
    at: Date,
    extra: Record<string, unknown> = {},
  ): Promise<{ checkInId: string; recId: string; light: string; taskId: string | null }> {
    const base = { ...CHECKINS[key], ...extra } as { demand?: { title?: string } };
    const known = base.demand?.title
      ? this.demandTasks.get(`${userId}:${base.demand.title}`)
      : undefined;
    const body =
      known && base.demand
        ? { ...base, demand: { ...base.demand, title: undefined, taskId: known } }
        : base;
    const input = checkInInputSchema.parse({ ...body, createdOnDeviceAt: at.toISOString() });
    const res = await this.get(CheckInService).create(userId, input, at);
    await this.backdateCheckIn(res.checkIn.id, at);
    if (res.card.taskId && !known) {
      await this.prisma.task.update({ where: { id: res.card.taskId }, data: { createdAt: at } });
      if (base.demand?.title)
        this.demandTasks.set(`${userId}:${base.demand.title}`, res.card.taskId);
    }
    await this.settleRecovery(userId, at);
    return {
      checkInId: res.checkIn.id,
      recId: res.card.id,
      light: res.card.light,
      taskId: res.card.taskId,
    };
  }

  /** A re-check opens the Blue window from the real clock; move it to the seeded time. */
  async settleRecovery(userId: string, at: Date): Promise<void> {
    await new Promise((r) => setTimeout(r, 25));
    await this.prisma.feedback.updateMany({
      where: { userId, recoveryStartedAt: { gt: new Date(Date.now() - 3_600_000) } },
      data: { recoveryStartedAt: at, recoveryEndsAt: new Date(at.getTime() + 45 * 60_000) },
    });
  }

  async backdateCheckIn(checkInId: string, at: Date): Promise<void> {
    await this.prisma.checkIn.update({ where: { id: checkInId }, data: { createdAt: at } });
    await this.prisma.recommendation.updateMany({ where: { checkInId }, data: { createdAt: at } });
  }

  /** A tool session with "did it help?", finished `minutes` after `at`. */
  async session(
    userId: string,
    s: {
      recId?: string | undefined;
      pathway: string;
      toolId: string;
      at: Date;
      minutes: number;
      outcome?: 'helped' | 'a_bit' | 'not_really' | 'skipped';
      taskId?: string;
      practiceId?: string;
    },
  ): Promise<string> {
    const sessions = this.get(SessionsService);
    const started = await sessions.start(userId, {
      pathway: s.pathway as never,
      toolId: s.toolId,
      origin: 'online',
      ...(s.recId ? { recommendationId: s.recId } : {}),
      ...(s.taskId ? { taskId: s.taskId } : {}),
      ...(s.practiceId ? { practiceId: s.practiceId } : {}),
    });
    await sessions.update(userId, started.id, {
      completed: s.outcome !== 'skipped',
      stoppedEarly: s.outcome === 'skipped',
      lengthSeconds: s.minutes * 60,
    });
    if (s.outcome) await sessions.feedback(userId, started.id, { outcome: s.outcome });
    const end = new Date(s.at.getTime() + s.minutes * 60_000);
    await this.prisma.pathwaySession.update({
      where: { id: started.id },
      data: { startedAt: s.at, endedAt: end, createdAt: s.at },
    });
    await this.prisma.feedback.updateMany({
      where: { sessionId: started.id },
      data: { createdAt: end },
    });
    await this.prisma.recommendationAction.updateMany({
      where: { userId, recommendationId: s.recId ?? '00000000-0000-0000-0000-000000000000' },
      data: { at: s.at },
    });
    return started.id;
  }

  async backdate(
    model: 'task' | 'dump' | 'draft' | 'reflection' | 'practice',
    id: string,
    at: Date,
  ): Promise<void> {
    const data = { createdAt: at } as const;
    const delegate = this.prisma[model] as unknown as {
      update(args: { where: { id: string }; data: Prisma.TaskUpdateInput }): Promise<unknown>;
    };
    await delegate.update({ where: { id }, data });
  }
}
