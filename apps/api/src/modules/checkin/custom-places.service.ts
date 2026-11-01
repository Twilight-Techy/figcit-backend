import { Injectable } from '@nestjs/common';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import { CheckInOptionsService } from '../rulesets/checkin-options.service.js';

export interface CustomPlace {
  readonly id: string;
  readonly label: string;
  /** The standard place it is most like; what the engine gets (E-45). */
  readonly likeCode: string;
}

const MAX_PLACES = 20;

/**
 * The user's own places (S10 "Somewhere else", S90): a name only they see (encrypted), linked to
 * the standard place it is most like. Browse users keep theirs on the device.
 */
@Injectable()
export class CustomPlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly options: CheckInOptionsService,
  ) {}

  async list(userId: string): Promise<CustomPlace[]> {
    const rows = await this.prisma.customTag.findMany({
      where: { userId, type: 'context', deletedAt: null, likeCode: { not: null } },
      orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: MAX_PLACES,
    });
    const cipher = await this.crypto.forUser(userId);
    return rows.map((r) => ({
      id: r.id,
      label: cipher.dec(r.labelEnc),
      likeCode: r.likeCode ?? '',
    }));
  }

  async create(userId: string, label: string, likeCode: string): Promise<CustomPlace> {
    const lists = await this.options.current();
    const place = lists?.options.place.find((p) => p.code === likeCode);
    if (lists && (!place || place.group === 'custom'))
      throw new BadInput('Pick the place yours is most like.');
    const count = await this.prisma.customTag.count({
      where: { userId, type: 'context', deletedAt: null },
    });
    if (count >= MAX_PLACES) throw new BadInput(`You can keep up to ${String(MAX_PLACES)} places.`);
    const cipher = await this.crypto.forUser(userId);
    const row = await this.prisma.customTag.create({
      data: { userId, type: 'context', labelEnc: cipher.enc(label), likeCode },
      select: { id: true },
    });
    return { id: row.id, label, likeCode };
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.customTag.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new NotFound('place');
  }
}
