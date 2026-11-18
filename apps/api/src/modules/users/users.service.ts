import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Forbidden, NotFound } from '../../common/errors/errors.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import type { z } from 'zod';
import { PrivacyService } from '../privacy/privacy.service.js';
import type {
  detailsResultSchema,
  detailsSchema,
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
    private readonly privacy: PrivacyService,
  ) {}

  async me(userId: string): Promise<MeDto> {
    const row = await this.repo.findMe(userId);
    if (!row) throw new NotFound('user');
    const tier = await this.entitlements.tierFor(userId);
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
      detailsDone:
        row.nickname !== null && row.ageConfirmedAt !== null && row.termsAcceptedAt !== null,
      isGuest: row.isGuest,
      guestExpiresAt: row.isGuest ? (row.guestExpiresAt?.toISOString() ?? null) : null,
      productUpdates: row.productUpdates,
      hasPassword: row.passwordHash !== null,
      plan: tier === 'free' ? 'free' : 'plus',
      tier,
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

  /**
   * Your details (S04a) and the age rule. Only the band is stored, never a date of birth (SU-4).
   * Under 16 the account just made is erased at once: nothing about a child is kept.
   */
  async saveDetails(
    userId: string,
    d: z.infer<typeof detailsSchema>,
  ): Promise<z.infer<typeof detailsResultSchema>> {
    if (d.ageBand === 'under_16') {
      await this.privacy.eraseNow(userId);
      return { outcome: 'not_available', me: null };
    }
    const current = await this.repo.findMe(userId);
    if (!current) throw new NotFound('user');
    const viaInstitution = d.ageBand === '16_17';
    const covered = viaInstitution && (await this.repo.inInstitution(userId));
    // An institution-covered account stays one; only the institution can change that.
    const keepBand = current.ageBand === 'minor_institution';
    await this.repo.update(userId, {
      nickname: d.nickname,
      region: d.region,
      termsAcceptedAt: current.termsAcceptedAt ?? new Date(),
      productUpdates: d.productUpdates,
      ...(keepBand
        ? {}
        : !viaInstitution
          ? { ageConfirmedAt: new Date(), ageBand: 'adult' as const }
          : covered
            ? { ageConfirmedAt: new Date(), ageBand: 'minor_institution' as const }
            : { ageConfirmedAt: null, ageBand: null }),
    });
    const me = await this.me(userId);
    return { outcome: me.ageConfirmed ? 'ok' : 'needs_institution', me };
  }

  async confirmAge(userId: string, viaInstitution = false): Promise<MeDto> {
    // An institution-covered under-18 account stays one; only the institution can change that.
    const current = await this.me(userId);
    if (current.ageBand === 'minor_institution') return current;
    if (viaInstitution) {
      if (!(await this.repo.inInstitution(userId)))
        throw new Forbidden(
          "Under 18, FigCit is available through an institution. Join with your institution's code first.",
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
