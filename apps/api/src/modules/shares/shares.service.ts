import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { ENV, type Env } from '../../common/config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { randomToken, sha256 } from '../../common/crypto/envelope.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { Gone, NotFound } from '../../common/errors/errors.js';
import { InboxService } from '../notifications/inbox.service.js';
import type { ProgressDto } from '../progress/progress.schemas.js';
import { ProgressService } from '../progress/progress.service.js';
import type {
  shareCreatedSchema,
  shareCreateSchema,
  shareSchema,
  sharedViewSchema,
} from './shares.schemas.js';

type ShareDto = z.infer<typeof shareSchema>;

const PICK: Readonly<Record<string, (keyof ProgressDto)[]>> = {
  lights: ['days', 'lights', 'checkIns'],
  did_it_help: ['didItHelp'],
  pathways: ['pathways'],
  tasks: ['tasks'],
  reflections: ['reflections'],
  notes: ['notes'],
};

/** Read-only reports the user chooses to share; a frozen copy, revocable, expiring (M12, S50–S51). */
@Injectable()
export class SharesService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly progress: ProgressService,
    private readonly inbox: InboxService,
  ) {}

  private dto(
    r: {
      id: string;
      recipientLabelEnc: Uint8Array | null;
      sections: string[];
      rangeDays: number;
      expiresAt: Date;
      revokedAt: Date | null;
      viewCount: number;
      lastViewedAt: Date | null;
      createdAt: Date;
    },
    label: string | null,
  ): ShareDto {
    return {
      id: r.id,
      recipientLabel: label,
      sections: r.sections,
      rangeDays: r.rangeDays,
      expiresAt: r.expiresAt.toISOString(),
      revoked: r.revokedAt !== null,
      viewCount: r.viewCount,
      lastViewedAt: r.lastViewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async create(
    userId: string,
    input: z.infer<typeof shareCreateSchema>,
  ): Promise<z.infer<typeof shareCreatedSchema>> {
    const full = await this.progress.progress(userId, input.rangeDays);
    const report: Partial<ProgressDto> = {
      rangeDays: full.rangeDays,
      from: full.from,
      to: full.to,
    };
    for (const s of input.sections)
      for (const k of PICK[s] ?? []) Object.assign(report, { [k]: full[k] });
    const c = await this.crypto.forUser(userId);
    const token = randomToken(24);
    const row = await this.prisma.share.create({
      data: {
        userId,
        recipientLabelEnc: c.encOpt(input.recipientLabel),
        sections: input.sections,
        rangeDays: input.rangeDays,
        snapshotEnc: c.enc(JSON.stringify(report)),
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
      },
    });
    return {
      ...this.dto(row, input.recipientLabel ?? null),
      token,
      url: `${this.env.APP_URL.replace(/\/$/, '')}/shared/?t=${token}`,
    };
  }

  async list(userId: string): Promise<ShareDto[]> {
    const rows = await this.prisma.share.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const c = await this.crypto.forUser(userId);
    return rows.map((r) => this.dto(r, c.decOpt(r.recipientLabelEnc)));
  }

  async revoke(userId: string, id: string): Promise<void> {
    const res = await this.prisma.share.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (res.count === 0 && (await this.prisma.share.count({ where: { id, userId } })) === 0)
      throw new NotFound('share');
  }

  /** The recipient's view. No sign-in; the token is the key, and it can be revoked. */
  async view(token: string): Promise<z.infer<typeof sharedViewSchema>> {
    const row = await this.prisma.share.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { select: { nickname: true, deletedAt: true } } },
    });
    if (!row || row.user.deletedAt) throw new NotFound('share');
    if (row.revokedAt || row.expiresAt < new Date())
      throw new Gone('This link has been turned off or has expired.');
    const c = await this.crypto.forUser(row.userId);
    await this.prisma.share.update({
      where: { id: row.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });
    if (row.viewCount === 0)
      await this.inbox.add(row.userId, 'share_viewed', { type: 'share', id: row.id });
    return {
      sharedBy: row.user.nickname ?? 'Someone',
      recipientLabel: c.decOpt(row.recipientLabelEnc),
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      sections: row.sections,
      report: JSON.parse(c.dec(row.snapshotEnc)) as Partial<ProgressDto>,
    };
  }
}
