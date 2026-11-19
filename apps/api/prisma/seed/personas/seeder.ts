// Helpers that create persona data through the real services, then move timestamps into the past.
import type { INestApplicationContext } from '@nestjs/common';
import argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import { CryptoService } from '../../../src/common/crypto/crypto.service.js';
import { PrismaService } from '../../../src/common/db/prisma.service.js';
import { checkInInputSchema } from '../../../src/modules/checkin/checkin.schemas.js';
import { CheckInService } from '../../../src/modules/checkin/checkin.service.js';
import { ConsentService } from '../../../src/modules/consent/consent.service.js';
import { DecisionsV5Service } from '../../../src/modules/decisions/decisions-v5.service.js';
import { EngineRuntimeService } from '../../../src/modules/decisions/engine-runtime.service.js';
import { checkInV5Schema } from '../../../src/modules/decisions/v5.schemas.js';
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

/** What a persona check-in made, as the persona helpers need it. */
export interface CheckInMade {
  readonly checkInId: string;
  /** The v3.3 recommendation; null for a v5.0 check-in, which has none. */
  readonly recId: string | null;
  readonly light: string;
  readonly taskId: string | null;
  /** The card's main tool, for a session after it. */
  readonly tool: { readonly pathway: string; readonly toolId: string } | null;
}

interface V3CheckIn {
  readonly state: { kind: string; energy?: number; mood?: number };
  readonly emotions?: readonly { code: string; intensity: number }[];
  readonly ownWords?: string;
  readonly recheckOfId?: string;
}

/** The last whole words of `text` that fit in `max` characters. */
const lastWords = (text: string, max: number): string => {
  const words = text.trim().split(/\s+/);
  let out = '';
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const next = out ? `${words[i] ?? ''} ${out}` : (words[i] ?? '');
    if (next.length > max) break;
    out = next;
  }
  return out || text.trim().slice(-max);
};

/** v3.3 feelings v5.0 doesn't have, as the nearest v5.0 feeling. */
const V5_FEELING: Readonly<Record<string, string>> = {
  focused: 'clear_headed',
  tired: 'unmotivated',
  grief: 'teary_or_sad',
};

export class Seeder {
  readonly prisma: PrismaService;
  private passwordHash: string | undefined;
  /** Demand title → task, per user, so a repeated demand reuses its task like the app does. */
  private readonly demandTasks = new Map<string, string>();
  /** Whether the published rule set is v5.0, which takes v5.0 check-ins only (asked once). */
  private v5: boolean | undefined;

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
    // On a fresh database the demo admin becomes the staff Owner; a real Owner is never touched.
    await this.prisma.staffOwner.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
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

  /**
   * One check-in at `at`. The persona check-ins are written as v3.3 check-ins; when v5.0 is the
   * published rule set (as in production), each goes in as a v5.0 check-in with the same state,
   * feelings, re-check and own words instead, since v5.0 knows none of the v3.3 places or needs.
   */
  async checkIn(
    userId: string,
    key: CheckInKey,
    at: Date,
    extra: Record<string, unknown> = {},
  ): Promise<CheckInMade> {
    this.v5 ??= (await this.get(EngineRuntimeService).current()).label.startsWith('5');
    if (this.v5) return this.checkInV5(userId, { ...CHECKINS[key], ...extra }, at);
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
    const rec = await this.prisma.recommendation.findUniqueOrThrow({
      where: { id: res.card.id },
      select: { primary: true },
    });
    const primary = rec.primary as { pathway?: string; toolId?: string } | null;
    return {
      checkInId: res.checkIn.id,
      recId: res.card.id,
      light: res.card.light,
      taskId: res.card.taskId,
      tool:
        primary?.pathway && primary.toolId
          ? { pathway: primary.pathway, toolId: primary.toolId }
          : null,
    };
  }

  private async checkInV5(userId: string, c: V3CheckIn, at: Date): Promise<CheckInMade> {
    const emotions = (c.emotions ?? [])
      .map((e) => ({ code: V5_FEELING[e.code] ?? e.code, level: Math.max(1, e.intensity) }))
      .slice(0, 2);
    const body = checkInV5Schema.parse({
      mode: emotions.length ? 'full' : 'quick',
      state: c.state.kind === 'grid' ? c.state : { kind: 'not_sure' },
      emotions,
      // Own words are Something else's 30 characters in v5.0, still screened for safety: the end
      // of the words, where a risk phrase like "end it" sits.
      ...(c.ownWords ? { somethingElse: { text: lastWords(c.ownWords, 30) } } : {}),
      ...(c.recheckOfId ? { recheckOfId: c.recheckOfId } : {}),
    });
    const made = await this.get(DecisionsV5Service).decide(body, userId, at);
    await this.settleRecovery(userId, at);
    const primary = made.card.primary;
    return {
      checkInId: made.id,
      // A v5.0 check-in has no v3.3 recommendation row: sessions start from the tool alone.
      recId: null,
      light: made.card.light ?? '',
      taskId: null,
      tool:
        primary?.kind === 'tool' && primary.pathway
          ? { pathway: primary.pathway, toolId: primary.code }
          : null,
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
