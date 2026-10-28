import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import { AiService } from '../ai/ai.service.js';
import { sortDump } from '../ai/ai.tasks.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { DUMP_SELECT } from './dump.service.js';

/** sortDump suggestions for Plus users, after a dump is saved (Advanced; kept apart from the user's choice). */
@Injectable()
export class DumpSortService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly ai: AiService,
    private readonly entitlements: EntitlementsService,
    private readonly events: DomainEvents,
  ) {}

  onModuleInit(): void {
    this.events.on('dump.created', (e) => this.suggest(e.userId, e.dumpId));
  }

  async suggest(userId: string, dumpId: string): Promise<void> {
    if ((await this.entitlements.tierFor(userId)) !== 'plus') return;
    const row = await this.prisma.dump.findFirst({
      where: { id: dumpId, userId },
      select: DUMP_SELECT,
    });
    if (!row || row.items.length === 0) return;
    const c = await this.crypto.forUser(userId);
    const res = await this.ai.json(
      sortDump,
      { items: row.items.map((i) => ({ id: i.id, text: c.dec(i.textEnc) })) },
      { userId },
    );
    if (res.blocked) return;
    await this.prisma.$transaction(
      res.data.items.map((i) =>
        this.prisma.dumpItem.update({ where: { id: i.id }, data: { suggestedBucket: i.bucket } }),
      ),
    );
  }
}
