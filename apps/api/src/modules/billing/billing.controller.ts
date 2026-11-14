import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { EntitlementsService, PLAN_TIERS } from '../entitlements/entitlements.service.js';
import { BillingService } from './billing.service.js';

const planSchema = z.object({
  code: z.string(),
  name: z.string(),
  tier: z.enum(PLAN_TIERS),
  /** Pence before VAT. */
  priceMinor: z.number().int().nullable(),
  /** The VAT on that price, and the total a buyer pays. */
  vatMinor: z.number().int().nullable(),
  totalMinor: z.number().int().nullable(),
  /** The user can buy it here; otherwise an organisation arranges it (seats, the pilot). */
  buyable: z.boolean(),
  /** For a plan that ends by itself, such as the six-week pilot. */
  lengthDays: z.number().int().nullable(),
  currency: z.string(),
  interval: z.string().nullable(),
  features: z.array(z.string()),
});
const plansSchema = z.object({ vatPercent: z.number(), items: z.array(planSchema) });
const entitlementsSchema = z.object({
  /** @deprecated Use `level`: any paid plan reads as `plus` here. */
  tier: z.enum(['free', 'plus']),
  level: z.enum(PLAN_TIERS),
  items: z.array(
    z.object({
      planCode: z.string(),
      source: z.string(),
      status: z.string(),
      renewsAt: z.iso.datetime().nullable(),
      endsAt: z.iso.datetime().nullable(),
      graceUntil: z.iso.datetime().nullable(),
    }),
  ),
});
const checkoutSchema = z
  .object({ planCode: z.string().max(24), concessionConfirmed: z.boolean().default(false) })
  .strict();
const checkoutResultSchema = z.object({
  url: z.string(),
  sessionId: z.uuid(),
  /** What the buyer sees before paying: the price, the VAT, the total. */
  subtotalMinor: z.number().int(),
  vatMinor: z.number().int(),
  totalMinor: z.number().int(),
});
const completeSchema = z.object({ sessionId: z.uuid() }).strict();
const okSchema = z.object({ ok: z.literal(true) });
const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get('plans')
  @Route({
    summary: 'Plans and prices (S60)',
    tags: ['Plans'],
    access: 'public',
    response: plansSchema,
  })
  async plans(): Promise<z.infer<typeof plansSchema>> {
    return this.billing.plans();
  }

  @Get('me/entitlements')
  @Route({ summary: 'What I have access to', tags: ['Plans'], response: entitlementsSchema })
  async mine(@CurrentUser() user: RequestUser): Promise<z.infer<typeof entitlementsSchema>> {
    const [level, items] = await Promise.all([
      this.entitlements.tierFor(user.id),
      this.entitlements.list(user.id),
    ]);
    return {
      tier: level === 'free' ? 'free' : 'plus',
      level,
      items: items.map((e) => ({
        ...e,
        renewsAt: iso(e.renewsAt),
        endsAt: iso(e.endsAt),
        graceUntil: iso(e.graceUntil),
      })),
    };
  }

  @Post('billing/checkout')
  @Route({
    summary: 'Start buying Prime or Premium (S61): the total with VAT, before payment',
    tags: ['Plans'],
    body: checkoutSchema,
    response: checkoutResultSchema,
    status: 201,
  })
  checkout(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(checkoutSchema)) body: z.infer<typeof checkoutSchema>,
  ): Promise<z.infer<typeof checkoutResultSchema>> {
    return this.billing.checkout(user.id, body.planCode);
  }

  @Post('billing/fake/complete')
  @HttpCode(200)
  @Route({
    summary: 'Fake provider: finish a checkout',
    tags: ['Plans'],
    body: completeSchema,
    response: okSchema,
  })
  async complete(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(completeSchema)) body: z.infer<typeof completeSchema>,
  ): Promise<{ ok: true }> {
    await this.billing.completeFake(user.id, body.sessionId);
    return { ok: true };
  }

  @Post('billing/cancel')
  @HttpCode(200)
  @Route({
    summary: 'Cancel at the end of the period (S62)',
    tags: ['Plans'],
    response: z.object({ endsAt: z.iso.datetime() }),
  })
  cancel(@CurrentUser() user: RequestUser): Promise<{ endsAt: string }> {
    return this.billing.cancel(user.id);
  }

  @Post('billing/webhook')
  @HttpCode(200)
  @Route({
    summary: 'Payment provider events (signed)',
    tags: ['Plans'],
    access: 'public',
    response: z.object({ duplicate: z.boolean() }),
  })
  webhook(
    @Req() req: FastifyRequest,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<{ duplicate: boolean }> {
    return this.billing.webhook(JSON.stringify(req.body), signature);
  }
}
