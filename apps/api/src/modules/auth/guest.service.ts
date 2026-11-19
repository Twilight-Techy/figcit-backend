import { createHmac } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../common/config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError, BadInput, NotConfigured, TooMany } from '../../common/errors/errors.js';
import { GUEST_MS, GUEST_NICKNAME } from '../../common/guest/constants.js';
import { ConsentService } from '../consent/consent.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { SessionsService, type IssuedSession } from './sessions.service.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Starting a guest space (docs/GUEST_SPACE.md): a real account with no email, for an adult who has
 * accepted the Terms and Privacy, deleted 30 days after it is made. The endpoint is public, so it is
 * limited: per network address (an hour and a day) and in all (a day), counted from guest_signups,
 * where the address is kept only as a keyed hash for two days; and it can ask for a bot challenge.
 */
@Injectable()
export class GuestService {
  private readonly logger = new Logger('Guest');

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly users: UsersRepository,
    private readonly crypto: CryptoService,
    private readonly consent: ConsentService,
    private readonly sessions: SessionsService,
  ) {}

  /** A keyed hash of the address: the counter can tell two requests from one address apart, nothing more. */
  private addressHash(address: string): string {
    return createHmac('sha256', this.env.MASTER_KEYS).update(address).digest('hex');
  }

  /** The optional bot challenge: any siteverify-style service (Turnstile, hCaptcha, reCAPTCHA). */
  private async challenge(token: string | undefined, address: string): Promise<void> {
    if (!this.env.GUEST_BOT_CHALLENGE) return;
    if (!this.env.GUEST_BOT_VERIFY_URL || !this.env.GUEST_BOT_SECRET)
      throw new NotConfigured('The bot challenge (GUEST_BOT_VERIFY_URL and GUEST_BOT_SECRET)');
    if (!token) throw new BadInput('Please complete the check and try again.');
    const res = await fetch(this.env.GUEST_BOT_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: this.env.GUEST_BOT_SECRET,
        response: token,
        remoteip: address,
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    const ok = res?.ok ? ((await res.json()) as { success?: unknown }).success === true : false;
    if (!ok) throw new BadInput('That check did not pass. Please try again.');
  }

  /** Seconds until the oldest of the `limit` newest sign-ups from this address leaves the window. */
  private async waitFor(hash: string, windowMs: number, limit: number, now: Date): Promise<number> {
    const edge = await this.prisma.guestSignup.findFirst({
      where: { addrHash: hash, createdAt: { gt: new Date(now.getTime() - windowMs) } },
      orderBy: { createdAt: 'desc' },
      skip: Math.max(0, limit - 1),
      select: { createdAt: true },
    });
    return edge ? (edge.createdAt.getTime() + windowMs - now.getTime()) / 1000 : 60;
  }

  /**
   * The limits, all flood guards: per address an hour and a day (600 and 3000 by default), and, only
   * if GUEST_DAILY_CAP is set above 0, in all. A limit answers 429 with Retry-After and a calm
   * sentence. The service-wide cap is off by default: it could turn real people away, so a busy day
   * is a log warning for a human instead (see `alert`).
   */
  private async assertRoom(hash: string, now: Date): Promise<void> {
    const { GUEST_SIGNUPS_PER_HOUR: perHour, GUEST_SIGNUPS_PER_DAY: perDay } = this.env;
    const [hour, day] = await Promise.all([
      this.prisma.guestSignup.count({
        where: { addrHash: hash, createdAt: { gt: new Date(now.getTime() - HOUR) } },
      }),
      this.prisma.guestSignup.count({
        where: { addrHash: hash, createdAt: { gt: new Date(now.getTime() - DAY) } },
      }),
    ]);
    if (hour >= perHour) throw new TooMany(undefined, await this.waitFor(hash, HOUR, perHour, now));
    if (day >= perDay) throw new TooMany(undefined, await this.waitFor(hash, DAY, perDay, now));
    if (this.env.GUEST_DAILY_CAP > 0) {
      const all = await this.prisma.guestSignup.count({
        where: { createdAt: { gt: new Date(now.getTime() - DAY) } },
      });
      if (all >= this.env.GUEST_DAILY_CAP)
        throw new AppError(
          503,
          'guest_unavailable',
          'Guest spaces are paused for today',
          'Please try again tomorrow, or create an account.',
        );
    }
  }

  private lastAlert = 0;

  /**
   * A structured warning when more than GUEST_ALERT_PER_HOUR guest spaces were made in the last
   * hour, at most once every ten minutes, so a person can look (and turn on the bot challenge) while
   * nobody is turned away.
   */
  private async alert(now: Date): Promise<void> {
    const threshold = this.env.GUEST_ALERT_PER_HOUR;
    if (threshold === 0 || now.getTime() - this.lastAlert < 10 * 60_000) return;
    const lastHour = await this.prisma.guestSignup.count({
      where: { createdAt: { gt: new Date(now.getTime() - HOUR) } },
    });
    if (lastHour <= threshold) return;
    this.lastAlert = now.getTime();
    this.logger.warn(
      { lastHour, threshold },
      'guest spaces made in the last hour are above the alert threshold: a bot wave? consider GUEST_BOT_CHALLENGE',
    );
  }

  async create(
    address: string,
    botToken: string | undefined,
    deviceLabel: string | undefined,
    now = new Date(),
  ): Promise<IssuedSession> {
    await this.challenge(botToken, address);
    const hash = this.addressHash(address);
    await this.assertRoom(hash, now);
    await this.prisma.guestSignup.create({ data: { addrHash: hash, createdAt: now } });
    await this.alert(now);
    const { id } = await this.users.create({
      email: null,
      dataKeyEnc: this.crypto.newWrappedKey(),
      emailVerified: false,
      nickname: GUEST_NICKNAME,
      guest: { expiresAt: new Date(now.getTime() + GUEST_MS) },
    });
    // The wellbeing consent the service needs; the optional ones start off and are never asked here.
    await this.consent.record(
      id,
      [
        { purpose: 'wellbeing_data', granted: true },
        { purpose: 'personalisation', granted: false },
        { purpose: 'analytics', granted: false },
        { purpose: 'research', granted: false },
      ],
      'guest',
    );
    return this.sessions.issue(id, deviceLabel);
  }
}
