import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Forbidden, NotFound } from '../../common/errors/errors.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import type { z } from 'zod';
import type {
  MeDto,
  mePatchSchema,
  PreferencesDto,
  preferencesPatchSchema,
} from './users.schemas.js';
import { UsersRepository, type MeRow } from './users.repository.js';

type PreferencesRow = NonNullable<MeRow['preferences']>;

const DEFAULT_PREFERENCES: PreferencesDto = {
  textSize: 0,
  theme: 'fig_citrus',
  followSystemTheme: true,
  highContrast: false,
  reduceMotion: false,
  sound: true,
  haptics: true,
  dyslexicFont: false,
  lowStimulation: false,
  notificationStyle: 'gentle',
  quietHoursStart: 21 * 60,
  quietHoursEnd: 8 * 60,
  inWorship: false,
  inWorshipUntil: null,
  taskNudgesPerDay: 2,
  notifyCategories: ['checkin', 'tasks', 'practices', 'recheck'],
  patternPrompts: true,
  personalisation: true,
};

export function preferencesDto(p: PreferencesRow | null): PreferencesDto {
  if (!p) return DEFAULT_PREFERENCES;
  return {
    textSize: p.textSize,
    theme: p.theme,
    followSystemTheme: p.followSystemTheme,
    highContrast: p.highContrast,
    reduceMotion: p.reduceMotion,
    sound: p.sound,
    haptics: p.haptics,
    dyslexicFont: p.dyslexicFont,
    lowStimulation: p.lowStimulation,
    notificationStyle: p.notificationStyle,
    quietHoursStart: p.quietHoursStart,
    quietHoursEnd: p.quietHoursEnd,
    inWorship: p.inWorship,
    inWorshipUntil: p.inWorshipUntil?.toISOString() ?? null,
    taskNudgesPerDay: p.taskNudgesPerDay,
    notifyCategories: p.notifyCategories as PreferencesDto['notifyCategories'],
    patternPrompts: p.patternPrompts,
    personalisation: p.personalisation,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly entitlements: EntitlementsService,
  ) {}

  async me(userId: string): Promise<MeDto> {
    const row = await this.repo.findMe(userId);
    if (!row) throw new NotFound('user');
    const plan = await this.entitlements.tierFor(userId);
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerifiedAt !== null,
      nickname: row.nickname,
      roles: row.roles,
      ageConfirmed: row.ageConfirmedAt !== null,
      ageBand: row.ageBand,
      locale: row.locale,
      region: row.region,
      timezone: row.timezone,
      helpWith: row.helpWith,
      journeySeen: row.journeySeenAt !== null,
      setupDone: row.setupDoneAt !== null,
      hasPassword: row.passwordHash !== null,
      plan,
      tenant: row.tenant,
      createdAt: row.createdAt.toISOString(),
      preferences: preferencesDto(row.preferences),
    };
  }

  async update(userId: string, patch: z.infer<typeof mePatchSchema>): Promise<MeDto> {
    const data: Prisma.UserUpdateInput = {
      ...(patch.nickname !== undefined ? { nickname: patch.nickname } : {}),
      ...(patch.locale ? { locale: patch.locale } : {}),
      ...(patch.region ? { region: patch.region } : {}),
      ...(patch.timezone ? { timezone: patch.timezone } : {}),
      ...(patch.helpWith ? { helpWith: patch.helpWith } : {}),
      ...(patch.journeySeen ? { journeySeenAt: new Date() } : {}),
      ...(patch.setupDone ? { setupDoneAt: new Date() } : {}),
    };
    await this.repo.update(userId, data);
    return this.me(userId);
  }

  async confirmAge(userId: string, viaInstitution = false): Promise<MeDto> {
    // An institution-covered under-18 account stays one; only the institution can change that.
    const current = await this.me(userId);
    if (current.ageBand === 'minor_institution') return current;
    if (viaInstitution) {
      if (!(await this.repo.inInstitution(userId)))
        throw new Forbidden(
          "Under 18, NUCCESS is available through an institution. Join with your institution's code first.",
        );
    }
    await this.repo.update(userId, {
      ageConfirmedAt: new Date(),
      ageBand: viaInstitution ? 'minor_institution' : 'adult',
    });
    return this.me(userId);
  }

  /**
   * Last-write-wins per field: a field is updated only if the client's change is newer than the
   * stored change for that field (SYSTEM_DESIGN §8). O(f) for f ≤ 18 fields.
   */
  async updatePreferences(
    userId: string,
    patch: z.infer<typeof preferencesPatchSchema>,
  ): Promise<PreferencesDto> {
    const current = await this.repo.findPreferences(userId);
    const stamps = (current?.fieldUpdatedAt ?? {}) as Record<string, string>;
    const at = patch.clientUpdatedAt ?? new Date().toISOString();
    const data: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(patch)) {
      if (field === 'clientUpdatedAt' || value === undefined) continue;
      const previous = stamps[field];
      if (previous && previous > at) continue;
      data[field] =
        field === 'inWorshipUntil' && typeof value === 'string' ? new Date(value) : value;
      stamps[field] = at;
    }
    const saved = await this.repo.upsertPreferences(userId, {
      ...data,
      fieldUpdatedAt: stamps,
    });
    return preferencesDto(saved);
  }
}
