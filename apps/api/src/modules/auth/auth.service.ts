import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type MagicLink } from '@prisma/client';
import argon2 from 'argon2';
import { ENV, type Env } from '../../common/config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { randomToken, safeEqual, sha256 } from '../../common/crypto/envelope.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import {
  BadInput,
  Conflict,
  Forbidden,
  Gone,
  TooMany,
  Unauthorized,
  NotConfigured,
} from '../../common/errors/errors.js';
import { MailService } from '../../platform/mail/mail.service.js';
import { emailLayout } from '../../platform/mail/template.js';
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
    const body = emailLayout({
      appUrl: this.env.APP_URL,
      heading: 'Your sign-in link',
      preheader: `Tap to open FigCit, or enter ${code}. It works for 10 minutes.`,
      paragraphs: ['Tap the button to open FigCit. The link works for 10 minutes.'],
      action: { label: 'Open FigCit', url },
      code: { label: 'On another device? Enter this code instead:', value: code },
      note: "If you didn't ask for this, you can ignore this email. Nobody can sign in without it.",
    });
    await this.mail.send({ to: email, subject: 'Your FigCit sign-in link', ...body });
  }

  /**
   * A guest space asks to keep an email (docs/GUEST_SPACE.md). The email is not attached here: only
   * opening the link from that mailbox does it. The answer is the same whether or not the address
   * has an account, so this cannot be used to find out. The mail says whose request it is and that
   * it can be ignored. Limited like the sign-in link, by address and by guest space.
   */
  async requestGuestLink(userId: string, email: string): Promise<void> {
    const guest = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isGuest: true },
    });
    if (!guest?.isGuest) throw new Forbidden('Only a guest space can do this.');
    const since = new Date(Date.now() - 15 * 60_000);
    const [byEmail, byGuest, today] = await Promise.all([
      this.prisma.magicLink.count({ where: { email, createdAt: { gt: since } } }),
      this.prisma.magicLink.count({
        where: { userId, purpose: 'link_guest', createdAt: { gt: since } },
      }),
      this.prisma.magicLink.count({
        where: {
          email,
          purpose: 'link_guest',
          createdAt: { gt: new Date(Date.now() - 24 * 3_600_000) },
        },
      }),
    ]);
    // The guest's own limit is answered (it is their own doing). The address's limits are not: an
    // address that has had its share is answered like any other, and nothing is sent, so nobody can
    // use this to tell which addresses are busy, and nobody can bury one in mail.
    if (byGuest >= 5) throw new TooMany();
    if (byEmail >= 5 || today >= this.env.GUEST_LINK_MAILS_PER_ADDRESS) return;
    const token = randomToken();
    await this.prisma.magicLink.create({
      data: {
        email,
        tokenHash: sha256(token),
        // A confirmation link has no 6-digit code: it can only be opened, never typed in elsewhere.
        codeHash: sha256(`${email}:${randomToken()}`),
        userId,
        purpose: 'link_guest',
        expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
      },
    });
    const url = `${this.env.APP_URL}/enter/link/?token=${encodeURIComponent(token)}`;
    const body = emailLayout({
      appUrl: this.env.APP_URL,
      heading: 'Confirm your email',
      preheader:
        'Confirm this email to keep your FigCit guest space. The link works for 10 minutes.',
      paragraphs: [
        'Someone, probably you, asked to keep a FigCit guest space with this email address. Tap the button to confirm it and keep everything in it. The link works for 10 minutes.',
      ],
      action: { label: 'Confirm my email', url },
      note: "If this wasn't you, ignore this email. Nothing happens unless the link is opened.",
    });
    await this.mail.send({ to: email, subject: 'Confirm your email', ...body });
  }

  async verifyMagicLink(
    input: { token: string } | { email: string; code: string },
    deviceLabel?: string,
  ): Promise<SignedIn> {
    const link =
      'token' in input
        ? await this.prisma.magicLink.findUnique({ where: { tokenHash: sha256(input.token) } })
        : await this.prisma.magicLink.findFirst({
            // A guest space's confirmation link is only ever opened: it is never the "newest link" a
            // typed code is checked against, so asking for one cannot get in the way of a sign-in.
            where: { email: input.email, usedAt: null, purpose: { not: 'link_guest' } },
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
    if (link.purpose === 'link_guest') return this.verifyGuestLink(link, deviceLabel);
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

  /**
   * Opening a guest space's confirmation link (docs/GUEST_SPACE.md). The link is spent first. An
   * email that already has an account is never attached: 409 email_has_account, and the guest space
   * stays as it was. Otherwise the same user keeps the email, verified, and stops being a guest:
   * same id, same data key, nothing copied. Opening the link again, for an email that is already
   * this account's, signs in the same account (a mail scanner may open it first).
   */
  private async verifyGuestLink(link: MagicLink, deviceLabel?: string): Promise<SignedIn> {
    const invalid = (): Unauthorized =>
      new Unauthorized('That link is not valid. Request a new one.');
    if (!link.userId) throw invalid();
    const user = await this.prisma.user.findUnique({
      where: { id: link.userId },
      select: { id: true, email: true, isGuest: true, guestExpiresAt: true, deletedAt: true },
    });
    if (!user || user.deletedAt) throw invalid();
    if (link.expiresAt < new Date()) throw new Gone('Links last 10 minutes. Request a new one.');
    const spent = await this.prisma.magicLink.updateMany({
      where: { id: link.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (spent.count === 0 || link.usedAt) {
      if (user.email === link.email)
        return { ...(await this.sessions.issue(user.id, deviceLabel)), isNew: false };
      throw new Gone('This link has already been used. Request a new one.');
    }
    if (!user.isGuest) throw new Gone('This guest space already has an account.');
    if ((user.guestExpiresAt ?? new Date(0)) <= new Date())
      throw new Gone('This guest space has ended.');
    await this.attachEmail(user.id, link.email);
    // Whoever holds a session of this guest space no longer does: only the one who opened the link,
    // from the mailbox, has one now.
    await this.event(user.id, 'magic_link', 'success');
    return { ...(await this.sessions.issue(user.id, deviceLabel)), isNew: false };
  }

  /**
   * Gives a guest space its confirmed email and ends its guest status, on the same user. An email
   * that has an account is refused with 409 email_has_account, however it is found out: by the
   * lookup, or by the unique email when two confirm the same one at once.
   */
  private async attachEmail(userId: string, email: string): Promise<void> {
    const taken = new Conflict(
      'That email already has an account. Sign in with it instead; this guest space stays as it is.',
      'email_has_account',
    );
    const other = await this.users.findByEmail(email);
    if (other && other.id !== userId) throw taken;
    try {
      // One transaction: the email arrives with no password on the account and no other session.
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: {
            email,
            emailVerifiedAt: new Date(),
            isGuest: false,
            guestExpiresAt: null,
            passwordHash: null,
          },
        }),
        this.prisma.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: 'guest_linked' },
        }),
      ]);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw taken;
      throw e;
    }
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
          ...emailLayout({
            appUrl: this.env.APP_URL,
            heading: 'We paused password sign-in for 15 minutes',
            preheader: 'Someone tried your password several times.',
            paragraphs: [
              'Someone tried your password several times. If it was you, wait 15 minutes or use a sign-in link.',
              "If it wasn't you, nothing has been accessed. You can change your password from Settings.",
            ],
          }),
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
      ...emailLayout({
        appUrl: this.env.APP_URL,
        heading: 'Reset your password',
        preheader: 'Choose a new password. The link works for 30 minutes.',
        paragraphs: ['Tap the button to choose a new password. The link works for 30 minutes.'],
        action: { label: 'Choose a new password', url },
        note: "If you didn't ask for this, you can ignore this email. Your password stays the same.",
      }),
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
    // A guest space is never restored: it has no mailbox to prove, and deleting one erases it.
    const who = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isGuest: true },
    });
    if (who?.isGuest) return;
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
