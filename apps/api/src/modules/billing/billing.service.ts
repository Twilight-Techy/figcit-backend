import { createHmac, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../common/config/env.js';
import { safeEqual } from '../../common/crypto/envelope.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import {
  AppError,
  BadInput,
  Forbidden,
  NotConfigured,
  NotFound,
} from '../../common/errors/errors.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import { InboxService } from '../notifications/inbox.service.js';

const DAY = 86_400_000;
const GRACE_DAYS = 7;
const SESSION_TTL_MS = 30 * 60_000;
const PERIOD_DAYS: Readonly<Record<string, number>> = { month: 30, year: 365 };

export interface WebhookEvent {
  readonly id: string;
  readonly type: 'payment_succeeded' | 'payment_failed' | 'subscription_ended';
  readonly userId: string;
  readonly planCode?: string;
}

/**
 * Plans and subscriptions. The `fake` provider (development, tests, demos) runs the full flow with
 * no card details; a real provider plugs in behind the same calls. No card data reaches us.
 */
@Injectable()
export class BillingService {
  private readonly sessions = new Map<string, { userId: string; planCode: string; at: number }>();

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
    private readonly events: DomainEvents,
  ) {}

  plans(): Promise<
    {
      code: string;
      name: string;
      priceMinor: number | null;
      currency: string;
      interval: string | null;
      features: string[];
    }[]
  > {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      select: {
        code: true,
        name: true,
        priceMinor: true,
        currency: true,
        interval: true,
        features: true,
      },
    });
  }

  async checkout(
    userId: string,
    planCode: string,
    concessionConfirmed: boolean,
  ): Promise<{ url: string; sessionId: string }> {
    if (this.env.BILLING_PROVIDER !== 'fake') throw new NotConfigured('Card payments');
    // ENT-8: purchases only by adults; under-18s are covered through an institution licence.
    const buyer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ageBand: true, ageConfirmedAt: true },
    });
    if (buyer?.ageBand === 'minor_institution')
      throw new Forbidden('Plus is for adults. Your institution licence already covers you.');
    if (!buyer?.ageConfirmedAt)
      throw new AppError(
        403,
        'age_unconfirmed',
        'Please confirm you are 18 or over',
        'Only adults can buy Plus.',
      );
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan?.active || !plan.priceMinor) throw new BadInput('That plan can’t be bought here.');
    if (plan.code === 'plus_concession' && !concessionConfirmed)
      throw new BadInput('Please confirm the concession applies to you.');
    const active = await this.prisma.entitlement.findFirst({
      where: {
        userId,
        status: { in: ['active', 'grace'] },
        planCode: { not: 'free' },
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    });
    if (active && active.renewsAt)
      throw new AppError(
        409,
        'already_subscribed',
        'You already have Plus',
        'Manage it from Plans.',
      );
    const sessionId = randomUUID();
    this.sessions.set(sessionId, { userId, planCode, at: Date.now() });
    return {
      sessionId,
      url: `${this.env.APP_URL.replace(/\/$/, '')}/plans/checkout/?session=${sessionId}`,
    };
  }

  /** Fake provider only: the checkout page's "Pay" button. */
  async completeFake(userId: string, sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s || s.userId !== userId || Date.now() - s.at > SESSION_TTL_MS)
      throw new NotFound('checkout session');
    this.sessions.delete(sessionId);
    await this.activate(userId, s.planCode, `fake_${sessionId}`);
  }

  private async activate(userId: string, planCode: string, providerRef: string): Promise<void> {
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { code: planCode } });
    const renewsAt = new Date(Date.now() + (PERIOD_DAYS[plan.interval ?? 'month'] ?? 30) * DAY);
    await this.prisma.$transaction([
      this.prisma.entitlement.updateMany({
        where: { userId, source: 'web', status: { in: ['active', 'grace'] } },
        data: { status: 'expired', endsAt: new Date() },
      }),
      this.prisma.entitlement.create({
        data: { userId, planCode, source: 'web', status: 'active', providerRef, renewsAt },
      }),
      this.prisma.billingCustomer.upsert({
        where: { userId },
        create: {
          userId,
          provider: this.env.BILLING_PROVIDER,
          providerCustomerId: `cus_${userId}`,
        },
        update: {},
      }),
    ]);
    await this.changed(userId);
  }

  private async changed(userId: string): Promise<void> {
    await this.inbox.add(userId, 'plan_changed');
    this.events.emit('entitlement.changed', { userId });
  }

  /** Cancels at the end of the paid period; Plus keeps working until then. */
  async cancel(userId: string): Promise<{ endsAt: string }> {
    const sub = await this.prisma.entitlement.findFirst({
      where: {
        userId,
        source: 'web',
        status: { in: ['active', 'grace'] },
        renewsAt: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub?.renewsAt) throw new NotFound('subscription');
    await this.prisma.entitlement.update({
      where: { id: sub.id },
      data: { endsAt: sub.renewsAt, renewsAt: null },
    });
    await this.changed(userId);
    return { endsAt: sub.renewsAt.toISOString() };
  }

  sign(body: string): string {
    return createHmac('sha256', this.env.BILLING_WEBHOOK_SECRET).update(body).digest('hex');
  }

  /** Provider webhooks, idempotent by event id. */
  async webhook(raw: string, signature: string | undefined): Promise<{ duplicate: boolean }> {
    if (!signature || !safeEqual(signature, this.sign(raw))) throw new Forbidden('Bad signature.');
    const e = JSON.parse(raw) as WebhookEvent;
    const seen = await this.prisma.billingEvent.findUnique({
      where: {
        provider_providerEventId: { provider: this.env.BILLING_PROVIDER, providerEventId: e.id },
      },
    });
    if (seen) return { duplicate: true };
    await this.prisma.billingEvent.create({
      data: {
        provider: this.env.BILLING_PROVIDER,
        providerEventId: e.id,
        type: e.type,
        userId: e.userId,
      },
    });
    const sub = await this.prisma.entitlement.findFirst({
      where: { userId: e.userId, source: 'web', status: { in: ['active', 'grace'] } },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (sub) await this.apply(e, sub.id, sub.plan.interval);
    await this.prisma.billingEvent.updateMany({
      where: { providerEventId: e.id },
      data: { processedAt: new Date() },
    });
    if (sub) await this.changed(e.userId);
    return { duplicate: false };
  }

  private async apply(e: WebhookEvent, id: string, interval: string | null): Promise<void> {
    const now = Date.now();
    if (e.type === 'payment_succeeded')
      await this.prisma.entitlement.update({
        where: { id },
        data: {
          status: 'active',
          graceUntil: null,
          renewsAt: new Date(now + (PERIOD_DAYS[interval ?? 'month'] ?? 30) * DAY),
        },
      });
    // A failed payment never cuts someone off mid-week: Plus keeps working through a grace period.
    else if (e.type === 'payment_failed')
      await this.prisma.entitlement.update({
        where: { id },
        data: {
          status: 'grace',
          graceUntil: new Date(now + GRACE_DAYS * DAY),
          endsAt: new Date(now + GRACE_DAYS * DAY),
        },
      });
    else
      await this.prisma.entitlement.update({
        where: { id },
        data: { status: 'expired', endsAt: new Date(now), renewsAt: null },
      });
  }
}
