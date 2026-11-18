import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';
import {
  profileSchema,
  type ProfileDto,
  type profilePatchSchema,
  type ProfileView,
} from './profile.schemas.js';

const DAY = 86_400_000;
const PROMPT_GAP_DAYS = 7;
const PROMPT_MAX = 3;
const SAFETY_QUIET_DAYS = 7;

/** A partial profile over the empty one, ignoring missing fields. */
function over(base: ProfileDto, patch: Partial<Record<keyof ProfileDto, unknown>>): ProfileDto {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) out[k] = v;
  return out as ProfileDto;
}

const EMPTY: ProfileDto = {
  pronouns: null,
  weekFills: [],
  studyLevel: null,
  jobField: null,
  carries: [],
  lifeNow: [],
  returnToWork: false,
};

/**
 * Me (ME-1 to ME-6): the optional profile, encrypted with the user's own key. Life right now
 * names everyday circumstances only, never changes the colour and never reaches an organisation.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async read(userId: string): Promise<ProfileDto> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileEnc: true },
    });
    if (!row) throw new NotFound('user');
    if (!row.profileEnc) return EMPTY;
    const text = (await this.crypto.forUser(userId)).dec(row.profileEnc);
    // Older or partial blobs: anything unknown or out of range falls back to empty.
    const parsed = profileSchema.partial().safeParse(JSON.parse(text));
    return over(EMPTY, parsed.success ? parsed.data : {});
  }

  async view(userId: string, now = new Date()): Promise<ProfileView> {
    return { ...(await this.read(userId)), promptDue: await this.promptDue(userId, now) };
  }

  async update(userId: string, patch: z.infer<typeof profilePatchSchema>): Promise<ProfileView> {
    const next = over(await this.read(userId), patch);
    const cipher = await this.crypto.forUser(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { profileEnc: cipher.enc(JSON.stringify(next)) },
    });
    return this.view(userId);
  }

  async dismissPrompt(userId: string, now = new Date()): Promise<ProfileView> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePromptDismissals: { increment: 1 }, profilePromptAt: now },
    });
    return this.view(userId, now);
  }

  private async promptDue(userId: string, now: Date): Promise<boolean> {
    const [user, checkIns, v5, safety] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { profilePromptDismissals: true, profilePromptAt: true, profileEnc: true },
      }),
      this.prisma.checkIn.count({ where: { userId }, take: 1 }),
      // A v5.0 check-in is a decision record (it never reaches the old table).
      this.prisma.decisionRecord.count({ where: { userId, light: { not: null } }, take: 1 }),
      this.prisma.safetyEvent.count({
        where: { userId, at: { gt: new Date(now.getTime() - SAFETY_QUIET_DAYS * DAY) } },
        take: 1,
      }),
    ]);
    if (user.profileEnc || (checkIns === 0 && v5 === 0) || safety > 0) return false;
    if (user.profilePromptDismissals >= PROMPT_MAX) return false;
    const last = user.profilePromptAt?.getTime();
    return last === undefined || now.getTime() - last >= PROMPT_GAP_DAYS * DAY;
  }
}
