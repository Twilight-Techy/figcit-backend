import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
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

  private async assertRoom(hash: string, now: Date): Promise<void> {
    const [hour, day, all] = await Promise.all([
      this.prisma.guestSignup.count({
        where: { addrHash: hash, createdAt: { gt: new Date(now.getTime() - HOUR) } },
      }),
      this.prisma.guestSignup.count({
        where: { addrHash: hash, createdAt: { gt: new Date(now.getTime() - DAY) } },
      }),
      this.prisma.guestSignup.count({
        where: { createdAt: { gt: new Date(now.getTime() - DAY) } },
      }),
    ]);
    if (hour >= this.env.GUEST_SIGNUPS_PER_HOUR || day >= this.env.GUEST_SIGNUPS_PER_DAY)
      throw new TooMany('Too many guest spaces from here. Try again later, or create an account.');
    if (all >= this.env.GUEST_DAILY_CAP)
      throw new AppError(
        503,
        'guest_unavailable',
        'Guest spaces are paused for today',
        'Please try again tomorrow, or create an account.',
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
