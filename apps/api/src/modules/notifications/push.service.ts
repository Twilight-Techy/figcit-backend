import { Inject, Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { ENV, type Env } from '../../common/config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';

const MAX_FAILURES = 5;

/** Web Push subscriptions (VAPID). Keys are encrypted; dead endpoints are dropped. */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');
  readonly enabled: boolean;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {
    this.enabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    if (this.enabled)
      webpush.setVapidDetails(
        env.VAPID_SUBJECT,
        env.VAPID_PUBLIC_KEY ?? '',
        env.VAPID_PRIVATE_KEY ?? '',
      );
  }

  get publicKey(): string | null {
    return this.env.VAPID_PUBLIC_KEY ?? null;
  }

  async subscribe(
    userId: string,
    input: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string | undefined;
    },
  ): Promise<{ id: string; createdAt: string }> {
    const c = await this.crypto.forUser(userId);
    const data = {
      userId,
      keysEnc: c.enc(JSON.stringify(input.keys)),
      userAgent: input.userAgent ?? null,
      failureCount: 0,
    };
    const row = await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { endpoint: input.endpoint, ...data },
      update: data,
      select: { id: true, createdAt: true },
    });
    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }

  async unsubscribe(userId: string, id: string): Promise<void> {
    const res = await this.prisma.pushSubscription.deleteMany({ where: { id, userId } });
    if (res.count === 0) throw new NotFound('push subscription');
  }

  /** Sends to every device; returns how many accepted it. */
  async send(
    userId: string,
    payload: { title: string; body: string; url: string; silent: boolean },
  ): Promise<number> {
    if (!this.enabled) return 0;
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return 0;
    const c = await this.crypto.forUser(userId);
    let ok = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: JSON.parse(c.dec(s.keysEnc)) as { p256dh: string; auth: string },
          },
          JSON.stringify(payload),
          { TTL: 3600, urgency: 'low' },
        );
        ok += 1;
        await this.prisma.pushSubscription.update({
          where: { id: s.id },
          data: { lastSuccessAt: new Date(), failureCount: 0 },
        });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410 || s.failureCount + 1 >= MAX_FAILURES)
          await this.prisma.pushSubscription.delete({ where: { id: s.id } });
        else
          await this.prisma.pushSubscription.update({
            where: { id: s.id },
            data: { failureCount: { increment: 1 } },
          });
        this.logger.warn({ status }, 'push failed');
      }
    }
    return ok;
  }
}
