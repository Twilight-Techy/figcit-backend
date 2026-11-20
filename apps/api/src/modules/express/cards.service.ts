import { Injectable } from '@nestjs/common';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import { MAX_OWN_CARDS, type CommCardDto, type CommCardInput } from './cards.schemas.js';

const SELECT = { id: true, textEnc: true, createdAt: true } as const;

/** The person's own communication cards (S117). The app screens the words for safety first. */
@Injectable()
export class CommCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async list(userId: string): Promise<CommCardDto[]> {
    const rows = await this.prisma.commCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: MAX_OWN_CARDS,
      select: SELECT,
    });
    const c = await this.crypto.forUser(userId);
    return rows.map((r) => ({
      id: r.id,
      text: c.dec(r.textEnc),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(userId: string, input: CommCardInput): Promise<CommCardDto> {
    const count = await this.prisma.commCard.count({ where: { userId } });
    if (count >= MAX_OWN_CARDS)
      throw new BadInput(`You can keep up to ${String(MAX_OWN_CARDS)} cards of your own.`);
    const c = await this.crypto.forUser(userId);
    const row = await this.prisma.commCard.create({
      data: { userId, textEnc: c.enc(input.text) },
      select: SELECT,
    });
    return { id: row.id, text: input.text, createdAt: row.createdAt.toISOString() };
  }

  async update(userId: string, id: string, input: CommCardInput): Promise<CommCardDto> {
    const c = await this.crypto.forUser(userId);
    const { count } = await this.prisma.commCard.updateMany({
      where: { id, userId },
      data: { textEnc: c.enc(input.text) },
    });
    if (count === 0) throw new NotFound('card');
    const row = await this.prisma.commCard.findUniqueOrThrow({ where: { id }, select: SELECT });
    return { id: row.id, text: input.text, createdAt: row.createdAt.toISOString() };
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.commCard.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFound('card');
  }
}
