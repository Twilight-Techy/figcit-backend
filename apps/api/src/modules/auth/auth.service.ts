import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { ENV, type Env } from '../../common/config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { randomToken, safeEqual, sha256 } from '../../common/crypto/envelope.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import {
  BadInput,
  Conflict,
  Gone,
  TooMany,
  Unauthorized,
  NotConfigured,
} from '../../common/errors/errors.js';
import { layout, MailService } from '../../platform/mail/mail.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { COMMON_PASSWORDS } from './common-passwords.js';
import { SessionsService, type IssuedSession } from './sessions.service.js';
import { newSecret, otpauthUri, verifyCode } from './totp.js';

const MAGIC_TTL_MS = 10 * 60_000; // 10 minutes (SYSTEM_DESIGN §6.1)
const RESET_TTL_MS = 30 * 60_000;
const BROWSE_TTL_MS = 90 * 86_400_000;
const LOCK_AFTER = 5; // failed password attempts (§9.1)
const LOCK_MS = 15 * 60_000;
const MAX_CODE_ATTEMPTS = 5;

// OWASP minimums for argon2id (ENGINEERING_RULES §6).
const ARGON = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export interface SignedIn extends IssuedSession {
  readonly isNew: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly users: UsersRepository,
    private readonly crypto: CryptoService,
    private readonly sessions: SessionsService,
    private readonly mail: MailService,
  ) {}

  // --- Magic link (D-11: the main sign-in) -------------------------------------------------

  /** Always answers the same way, whether or not the email has an account (§9.1). */
  async requestMagicLink(
    email: string,
    purpose: 'sign_in' | 'upgrade_from_browse',
    app: 'user' | 'staff' = 'user',
  ): Promise<void> {
    // A staff link opens the staff app; it needs that app's address configured (E-31, E-35).
    const base = app === 'staff' ? this.env.STAFF_APP_URL : this.env.APP_URL;
    if (!base) throw new NotConfigured('The staff app address (STAFF_APP_URL) is not set.');
    const recent = await this.prisma.magicLink.count({
      where: { email, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } },
    });
    if (recent >= 5) throw new TooMany();
    const token = randomToken();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const existing = await this.users.findByEmail(email);
    await this.prisma.magicLink.create({
      data: {
        email,
        tokenHash: sha256(token),
        codeHash: sha256(`${email}:${code}`),
        userId: existing?.id ?? null,
        purpose,
        expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
      },
    });
    const url = `${base}/enter/link/?token=${encodeURIComponent(token)}`;
    const body = layout(
      'Your sign-in link',
      [
        'Tap the button to open FigCit. The link works for 10 minutes.',
        `If you opened this on another device, enter this code instead: ${code}`,
        "If you didn't ask for this, you can ignore this email.",
      ],
      { label: 'Open FigCit', url },
    );
    await this.mail.send({ to: email, subject: 'Your FigCit sign-in link', ...body });
  }

  async verifyMagicLink(
    input: { token: string } | { email: string; code: string },
    deviceLabel?: string,
  ): Promise<SignedIn> {
    const link =
      'token' in input
        ? await this.prisma.magicLink.findUnique({ where: { tokenHash: sha256(input.token) } })
        : await this.prisma.magicLink.findFirst({
            where: { email: input.email, usedAt: null },
            orderBy: { createdAt: 'desc' },
          });
    if (!link) throw new Unauthorized('That link or code is not valid. Request a new one.');
    if ('code' in input) {
      if (link.attempts >= MAX_CODE_ATTEMPTS) throw new TooMany('Request a new link.');
      if (!safeEqual(link.codeHash, sha256(`${input.email}:${input.code}`))) {
        await this.prisma.magicLink.update({
          where: { id: link.id },
          data: { attempts: { increment: 1 } },
        });
        throw new Unauthorized('That code is not right. Check the email and try again.');
      }
    }
    if (link.usedAt) throw new Gone('This link has already been used. Request a new one.');
    if (link.expiresAt < new Date()) throw new Gone('Links last 10 minutes. Request a new one.');
    await this.prisma.magicLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });

    let isNew = false;
    let userId = link.userId ?? (await this.users.findByEmail(link.email))?.id;
    if (!userId) {
      userId = (
        await this.users.create({
          email: link.email,
          dataKeyEnc: this.crypto.newWrappedKey(),
          emailVerified: true,
        })
      ).id;
      isNew = true;
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
    }
    await this.restoreIfPending(userId);
    await this.assertActive(userId);
    await this.event(userId, 'magic_link', 'success');
    return { ...(await this.sessions.issue(userId, deviceLabel)), isNew };
  }

  // --- Password (optional) -------------------------------------------------------------------

  private checkStrength(password: string): void {
    if (COMMON_PASSWORDS.has(password.toLowerCase()))
      throw new BadInput('That password is very common. Try a longer phrase only you would know.');
  }

  async signUp(email: string, password: string, deviceLabel?: string): Promise<SignedIn> {
    this.checkStrength(password);
    if (await this.users.findByEmail(email))
      throw new Conflict('Try signing in, or use a sign-in link.', 'account_exists');
    const passwordHash = await argon2.hash(password, ARGON);
    const user = await this.users.create({
      email,
      dataKeyEnc: this.crypto.newWrappedKey(),
      emailVerified: false,
      passwordHash,
    });
    await this.event(user.id, 'password', 'success');
    return { ...(await this.sessions.issue(user.id, deviceLabel)), isNew: true };
  }

  async signIn(email: string, password: string, deviceLabel?: string): Promise<SignedIn> {
    const user = await this.users.findByEmail(email);
    const generic = new Unauthorized(
      "That email and password don't match. You can also use a sign-in link.",
    );
    if (!user?.passwordHash || user.deletedAt) {
      // Same cost as a real check, so timing doesn't reveal accounts.
      await argon2.hash(password, ARGON);
      throw generic;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.event(user.id, 'password', 'locked');
      throw new TooMany('Too many tries. Wait 15 minutes or use a sign-in link.');
    }
    if (!(await argon2.verify(user.passwordHash, password))) {
      const failed = user.failedSignIns + 1;
      const locked = failed >= LOCK_AFTER;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedSignIns: locked ? 0 : failed,
          lockedUntil: locked ? new Date(Date.now() + LOCK_MS) : null,
        },
      });
      await this.event(user.id, 'password', locked ? 'locked' : 'failure');
      if (locked)
        await this.mail.send({
          to: email,
          subject: 'We paused password sign-in',
          ...layout('We paused password sign-in for 15 minutes', [
            'Someone tried your password several times. If it was you, wait 15 minutes or use a sign-in link.',
            "If it wasn't you, nothing has been accessed. You can change your password from Settings.",
          ]),
        });
      throw generic;
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedSignIns: 0, lockedUntil: null },
    });
    await this.assertActive(user.id);
    await this.event(user.id, 'password', 'success');
    return { ...(await this.sessions.issue(user.id, deviceLabel)), isNew: false };
  }

  async forgot(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.deletedAt) return;
    const token = randomToken();
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    const url = `${this.env.APP_URL}/enter/reset/?token=${encodeURIComponent(token)}`;
    await this.mail.send({
      to: email,
      subject: 'Reset your FigCit password',
      ...layout(
        'Reset your password',
        [
          'The link works for 30 minutes.',
          "If you didn't ask for this, you can ignore this email.",
        ],
        { label: 'Choose a new password', url },
      ),
    });
  }

  async reset(token: string, password: string, deviceLabel?: string): Promise<SignedIn> {
    this.checkStrength(password);
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!reset || reset.usedAt || reset.expiresAt < new Date())
      throw new Gone('This reset link has expired. Request a new one.');
    const passwordHash = await argon2.hash(password, ARGON);
    await this.prisma.$transaction([
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash, failedSignIns: 0, lockedUntil: null, emailVerifiedAt: new Date() },
      }),
    ]);
    await this.sessions.revokeAll(reset.userId, 'password_reset');
    return { ...(await this.sessions.issue(reset.userId, deviceLabel)), isNew: false };
  }

  async setPassword(userId: string, password: string): Promise<void> {
    this.checkStrength(password);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(password, ARGON) },
    });
  }

  // --- Staff MFA (TOTP) ----------------------------------------------------------------------

  async enrolMfa(userId: string): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const secret = newSecret();
    const cipher = await this.crypto.forUser(userId);
    await this.prisma.mfaFactor.deleteMany({ where: { userId, confirmedAt: null } });
    await this.prisma.mfaFactor.create({ data: { userId, secretEnc: cipher.enc(secret) } });
    return { secret, otpauthUri: otpauthUri(secret, user.email ?? userId) };
  }

  async verifyMfa(userId: string, sessionId: string, code: string): Promise<IssuedSession> {
    const factors = await this.prisma.mfaFactor.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    const cipher = await this.crypto.forUser(userId);
    for (const factor of factors) {
      const step = verifyCode(cipher.dec(factor.secretEnc), code, Date.now());
      if (step === null || (factor.lastUsedStep !== null && BigInt(step) <= factor.lastUsedStep))
        continue;
      await this.prisma.mfaFactor.update({
        where: { id: factor.id },
        data: { lastUsedStep: BigInt(step), confirmedAt: factor.confirmedAt ?? new Date() },
      });
      await this.event(userId, 'mfa', 'success');
      return this.sessions.markMfa(sessionId, userId);
    }
    await this.event(userId, 'mfa', 'failure');
    throw new Unauthorized('That code did not match. Codes change every 30 seconds.');
  }

  // --- Browse mode ----------------------------------------------------------------------------

  async browseToken(): Promise<{ browseToken: string; expiresAt: Date }> {
    const token = `b_${randomToken()}`;
    const expiresAt = new Date(Date.now() + BROWSE_TTL_MS);
    await this.prisma.browseToken.create({ data: { tokenHash: sha256(token), expiresAt } });
    return { browseToken: token, expiresAt };
  }

  // --- Shared ---------------------------------------------------------------------------------

  async signInFederated(userId: string, isNew: boolean, deviceLabel?: string): Promise<SignedIn> {
    await this.assertActive(userId);
    await this.event(userId, 'google', 'success');
    return { ...(await this.sessions.issue(userId, deviceLabel)), isNew };
  }

  /**
   * Signing in with a magic link during the deletion grace period keeps the account (DECISIONS B-21).
   * Password sign-in doesn't, so only someone with the mailbox can bring an account back.
   */
  private async restoreIfPending(userId: string): Promise<void> {
    const pending = await this.prisma.deletionRequest.findFirst({
      where: { userId, cancelledAt: null, scheduledFor: { gt: new Date() } },
      select: { userId: true },
    });
    if (!pending) return;
    await this.prisma.$transaction([
      this.prisma.deletionRequest.update({ where: { userId }, data: { cancelledAt: new Date() } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'active', deletedAt: null },
      }),
      this.prisma.inboxItem.create({ data: { userId, kind: 'account_restored' } }),
    ]);
  }

  private async assertActive(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true, deletedAt: true },
    });
    if (user.status !== 'active' || user.deletedAt)
      throw new Unauthorized('This account is closed. Contact support if this is a mistake.');
  }

  private async event(
    userId: string | null,
    method: 'magic_link' | 'password' | 'google' | 'mfa',
    result: 'success' | 'failure' | 'locked',
  ): Promise<void> {
    await this.prisma.signInEvent.create({ data: { userId, method, result } });
  }
}
