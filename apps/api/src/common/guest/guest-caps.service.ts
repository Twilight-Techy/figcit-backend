import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service.js';
import { GuestLimit } from '../errors/errors.js';
import { GUEST_MAX_DUMPS, GUEST_MAX_OPEN_TASKS } from './constants.js';

/**
 * What a guest space may keep (docs/GUEST_SPACE.md): 20 open tasks and 50 dumps. An account has no
 * such limit, so these do nothing for one. Called where a task or a dump is made.
 */
@Injectable()
export class GuestCaps {
  constructor(private readonly prisma: PrismaService) {}

  private async isGuest(userId: string): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isGuest: true },
    });
    return row?.isGuest === true;
  }

  async assertTaskRoom(userId: string): Promise<void> {
    if (!(await this.isGuest(userId))) return;
    const open = await this.prisma.task.count({
      where: { userId, status: 'open', deletedAt: null },
    });
    if (open >= GUEST_MAX_OPEN_TASKS)
      throw new GuestLimit(
        `A guest space keeps up to ${String(GUEST_MAX_OPEN_TASKS)} open tasks. Finish one, or create an account to keep more.`,
      );
  }

  async assertDumpRoom(userId: string): Promise<void> {
    if (!(await this.isGuest(userId))) return;
    const kept = await this.prisma.dump.count({ where: { userId, deletedAt: null } });
    if (kept >= GUEST_MAX_DUMPS)
      throw new GuestLimit(
        `A guest space keeps up to ${String(GUEST_MAX_DUMPS)} dumps. Delete one, or create an account to keep more.`,
      );
  }
}
