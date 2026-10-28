import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';

const ME_SELECT = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  nickname: true,
  roles: true,
  ageConfirmedAt: true,
  ageBand: true,
  locale: true,
  region: true,
  timezone: true,
  helpWith: true,
  journeySeenAt: true,
  setupDoneAt: true,
  passwordHash: true,
  createdAt: true,
  status: true,
  tenant: { select: { id: true, name: true } },
  preferences: true,
} satisfies Prisma.UserSelect;

export type MeRow = Prisma.UserGetPayload<{ select: typeof ME_SELECT }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMe(userId: string): Promise<MeRow | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: ME_SELECT,
    });
  }

  findByEmail(email: string): Promise<{
    id: string;
    passwordHash: string | null;
    status: string;
    failedSignIns: number;
    lockedUntil: Date | null;
    roles: string[];
    deletedAt: Date | null;
  } | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        failedSignIns: true,
        lockedUntil: true,
        roles: true,
        deletedAt: true,
      },
    });
  }

  async create(
    data: {
      email: string | null;
      dataKeyEnc: Uint8Array<ArrayBuffer>;
      emailVerified: boolean;
      passwordHash?: string;
    },
    tx?: Tx,
  ): Promise<{ id: string }> {
    const db = tx ?? this.prisma;
    return db.user.create({
      data: {
        email: data.email,
        dataKeyEnc: data.dataKeyEnc,
        emailVerifiedAt: data.emailVerified ? new Date() : null,
        ...(data.passwordHash ? { passwordHash: data.passwordHash } : {}),
        // Quiet hours 21:00–08:00 by default (D-27).
        preferences: { create: { quietHoursStart: 21 * 60, quietHoursEnd: 8 * 60 } },
        entitlements: { create: { planCode: 'free', source: 'none' } },
      },
      select: { id: true },
    });
  }

  update(userId: string, data: Prisma.UserUpdateInput): Promise<{ id: string }> {
    return this.prisma.user.update({ where: { id: userId }, data, select: { id: true } });
  }

  findPreferences(userId: string): Promise<Prisma.PreferencesGetPayload<object> | null> {
    return this.prisma.preferences.findUnique({ where: { userId } });
  }

  upsertPreferences(
    userId: string,
    data: Prisma.PreferencesUncheckedUpdateInput,
  ): Promise<Prisma.PreferencesGetPayload<object>> {
    return this.prisma.preferences.upsert({
      where: { userId },
      update: data,
      create: { ...(data as Prisma.PreferencesUncheckedCreateInput), userId },
    });
  }
}
