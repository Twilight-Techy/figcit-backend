import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Inject } from '@nestjs/common';
import type { z } from 'zod';
import { ENV, type Env } from '../../common/config/env.js';
import { Unauthorized } from '../../common/errors/errors.js';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  authMethodsSchema,
  browseTokenSchema,
  forgotSchema,
  guestSignUpSchema,
  magicLinkRequestSchema,
  magicLinkVerifySchema,
  mfaCodeSchema,
  mfaEnrolSchema,
  okSchema,
  passwordSignInSchema,
  passwordSignUpSchema,
  refreshSchema,
  resetSchema,
  sessionSchema,
  sessionsListSchema,
  setPasswordSchema,
  type SessionDto,
} from './auth.schemas.js';
import { AuthService, type SignedIn } from './auth.service.js';
import { GoogleService } from './google.service.js';
import { GuestService } from './guest.service.js';
import { MailService } from '../../platform/mail/mail.service.js';
import { REFRESH_COOKIE, SessionsService, type IssuedSession } from './sessions.service.js';

const GOOGLE_COOKIE = 'figcit_g';
const STRICT = { rateLimit: { max: 10, timeWindow: '1 minute' } };

function device(req: FastifyRequest): string | undefined {
  const ua = req.headers['user-agent'];
  if (!ua) return undefined;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS/.test(ua)
        ? 'Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return `${browser}${os ? ` on ${os}` : ''}`;
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly google: GoogleService,
    private readonly guests: GuestService,
    private readonly mail: MailService,
  ) {}

  private native(req: FastifyRequest): boolean {
    return req.headers['x-client'] === 'native';
  }

  /** Browsers get the refresh token as an HttpOnly cookie; native clients in the body (§9.1). */
  private respond(
    req: FastifyRequest,
    reply: FastifyReply,
    session: IssuedSession,
    isNew = false,
  ): SessionDto {
    const secure = this.env.COOKIE_SECURE ?? this.env.NODE_ENV === 'production';
    void reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/v1/auth',
      // A guest space's cookie ends with the space.
      maxAge: session.isGuest
        ? Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))
        : this.env.REFRESH_TTL_DAYS * 86_400,
    });
    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      ...(this.native(req) ? { refreshToken: session.refreshToken } : {}),
      user: {
        id: session.userId,
        roles: [...session.roles],
        isNew,
        mfaRequired: session.mfaRequired,
        isGuest: session.isGuest,
      },
    };
  }

  private signedIn(req: FastifyRequest, reply: FastifyReply, s: SignedIn): SessionDto {
    return this.respond(req, reply, s, s.isNew);
  }

  @Post('guest')
  @HttpCode(201)
  @RouteConfig(STRICT)
  @Route({
    summary:
      'Start a guest space: an account with no email, for adults, kept for 30 days at most (limited per address and per day)',
    tags: ['Auth'],
    access: 'public',
    body: guestSignUpSchema,
    response: sessionSchema,
    status: 201,
  })
  async guest(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body(new ZodPipe(guestSignUpSchema)) body: z.infer<typeof guestSignUpSchema>,
  ): Promise<SessionDto> {
    const session = await this.guests.create(req.ip, body.botToken, device(req));
    return this.respond(req, reply, session, true);
  }

  @Post('magic-link')
  @HttpCode(202)
  @RouteConfig(STRICT)
  @Route({
    summary: 'Email a sign-in link and code (same answer whether or not the email has an account)',
    tags: ['Auth'],
    access: 'public',
    body: magicLinkRequestSchema,
    response: okSchema,
    status: 202,
  })
  async magicLink(
    @Body(new ZodPipe(magicLinkRequestSchema)) body: z.infer<typeof magicLinkRequestSchema>,
  ): Promise<{ ok: true }> {
    await this.auth.requestMagicLink(body.email, body.purpose, body.app);
    return { ok: true };
  }

  @Post('magic-link/verify')
  @HttpCode(200)
  @RouteConfig(STRICT)
  @Route({
    summary: 'Exchange a link token or the 6-digit code for a session',
    tags: ['Auth'],
    access: 'public',
    body: magicLinkVerifySchema,
    response: sessionSchema,
  })
  async verify(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body(new ZodPipe(magicLinkVerifySchema)) body: z.infer<typeof magicLinkVerifySchema>,
  ): Promise<SessionDto> {
    return this.signedIn(req, reply, await this.auth.verifyMagicLink(body, device(req)));
  }

  @Post('password/sign-up')
  @HttpCode(201)
  @RouteConfig(STRICT)
  @Route({
    summary: 'Create an account with email and password',
    tags: ['Auth'],
    access: 'public',
    body: passwordSignUpSchema,
    response: sessionSchema,
    status: 201,
  })
  async signUp(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body(new ZodPipe(passwordSignUpSchema)) body: z.infer<typeof passwordSignUpSchema>,
  ): Promise<SessionDto> {
    return this.signedIn(
      req,
      reply,
      await this.auth.signUp(body.email, body.password, device(req)),
    );
  }

  @Post('password/sign-in')
  @HttpCode(200)
  @RouteConfig(STRICT)
  @Route({
    summary: 'Sign in with email and password (locks for 15 minutes after 5 tries)',
    tags: ['Auth'],
    access: 'public',
    body: passwordSignInSchema,
    response: sessionSchema,
  })
  async signIn(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body(new ZodPipe(passwordSignInSchema)) body: z.infer<typeof passwordSignInSchema>,
  ): Promise<SessionDto> {
    return this.signedIn(
      req,
      reply,
      await this.auth.signIn(body.email, body.password, device(req)),
    );
  }

  @Post('password/forgot')
  @HttpCode(202)
  @RouteConfig(STRICT)
  @Route({
    summary: 'Email a password reset link',
    tags: ['Auth'],
    access: 'public',
    body: forgotSchema,
    response: okSchema,
    status: 202,
  })
  async forgot(
    @Body(new ZodPipe(forgotSchema)) body: z.infer<typeof forgotSchema>,
  ): Promise<{ ok: true }> {
    await this.auth.forgot(body.email);
    return { ok: true };
  }

  @Post('password/reset')
  @HttpCode(200)
  @RouteConfig(STRICT)
  @Route({
    summary: 'Choose a new password from a reset link',
    tags: ['Auth'],
    access: 'public',
    body: resetSchema,
    response: sessionSchema,
  })
  async reset(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body(new ZodPipe(resetSchema)) body: z.infer<typeof resetSchema>,
  ): Promise<SessionDto> {
    return this.signedIn(req, reply, await this.auth.reset(body.token, body.password, device(req)));
  }

  @Post('password')
  @HttpCode(200)
  @Route({
    summary: 'Set or change the password for the signed-in account',
    tags: ['Auth'],
    body: setPasswordSchema,
    response: okSchema,
  })
  async setPassword(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(setPasswordSchema)) body: z.infer<typeof setPasswordSchema>,
  ): Promise<{ ok: true }> {
    await this.auth.setPassword(user.id, body.password);
    return { ok: true };
  }

  @Post('refresh')
  @HttpCode(200)
  @Route({
    summary: 'Rotate the refresh token and get a new access token',
    tags: ['Auth'],
    access: 'public',
    body: refreshSchema,
    response: sessionSchema,
  })
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    // Browsers send the cookie and often no body at all.
    @Body(new ZodPipe(refreshSchema.optional())) body: z.infer<typeof refreshSchema> | undefined,
  ): Promise<SessionDto> {
    const token = body?.refreshToken ?? req.cookies[REFRESH_COOKIE];
    if (!token) throw new Unauthorized();
    return this.respond(req, reply, await this.sessions.rotate(token));
  }

  @Post('sign-out')
  @HttpCode(200)
  @Route({ summary: 'Sign out of this device', tags: ['Auth'], response: okSchema })
  async signOut(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ ok: true }> {
    await this.sessions.revoke(user.sessionId, 'sign_out');
    void reply.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
    return { ok: true };
  }

  @Post('sign-out-all')
  @HttpCode(200)
  @Route({ summary: 'Sign out of every device', tags: ['Auth'], response: okSchema })
  async signOutAll(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ ok: true }> {
    await this.sessions.revokeAll(user.id, 'sign_out_all');
    void reply.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
    return { ok: true };
  }

  @Get('sessions')
  @Route({ summary: 'Signed-in devices', tags: ['Auth'], response: sessionsListSchema })
  async list(@CurrentUser() user: RequestUser): Promise<z.infer<typeof sessionsListSchema>> {
    const rows = await this.sessions.list(user.id);
    return {
      sessions: rows.map((s) => ({
        id: s.id,
        deviceLabel: s.deviceLabel,
        current: s.id === user.sessionId,
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastUsedAt.toISOString(),
      })),
    };
  }

  @Post('mfa/enrol')
  @HttpCode(200)
  @Route({ summary: 'Start TOTP enrolment (staff)', tags: ['Auth'], response: mfaEnrolSchema })
  enrol(@CurrentUser() user: RequestUser): Promise<{ secret: string; otpauthUri: string }> {
    return this.auth.enrolMfa(user.id);
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @RouteConfig(STRICT)
  @Route({
    summary: 'Verify a TOTP code; staff sessions need this before admin routes',
    tags: ['Auth'],
    body: mfaCodeSchema,
    response: sessionSchema,
  })
  async mfa(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(mfaCodeSchema)) body: z.infer<typeof mfaCodeSchema>,
  ): Promise<SessionDto> {
    return this.respond(req, reply, await this.auth.verifyMfa(user.id, user.sessionId, body.code));
  }

  @Post('browse')
  @HttpCode(201)
  @RouteConfig(STRICT)
  @Route({
    summary: 'Anonymous Browse-mode device token (no account, nothing stored against it)',
    tags: ['Auth'],
    access: 'public',
    response: browseTokenSchema,
    status: 201,
  })
  async browse(): Promise<{ browseToken: string; expiresAt: string }> {
    const token = await this.auth.browseToken();
    return { browseToken: token.browseToken, expiresAt: token.expiresAt.toISOString() };
  }

  @Get('methods')
  @Route({
    summary: 'The sign-in methods that work here (SU-2): the app shows only these',
    tags: ['Auth'],
    access: 'public',
    response: authMethodsSchema,
  })
  methods(): z.infer<typeof authMethodsSchema> {
    // Email sign-in still works through the dev mailbox in development and tests.
    const email = this.mail.delivers || this.env.NODE_ENV !== 'production';
    return { password: true, emailCode: email, google: this.google.configured };
  }

  @Get('google/start')
  @Route({
    summary: 'Start Google sign-in (redirect)',
    tags: ['Auth'],
    access: 'public',
    status: 302,
  })
  async googleStart(@Res() reply: FastifyReply): Promise<void> {
    // Never a raw error page (SU-10): back to the app, which says so in plain words.
    const back = `${this.env.APP_URL}/enter/?error=google`;
    if (!this.google.configured) {
      void reply.redirect(back, 302);
      return;
    }
    const start = await this.google.start().catch(() => null);
    if (!start) {
      void reply.redirect(back, 302);
      return;
    }
    const secure = this.env.COOKIE_SECURE ?? this.env.NODE_ENV === 'production';
    void reply.setCookie(GOOGLE_COOKIE, `${start.state}.${start.verifier}`, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/v1/auth/google',
      maxAge: 600,
    });
    void reply.redirect(start.url, 302);
  }

  @Get('google/callback')
  @Route({
    summary: 'Google redirects back here; sets the session cookie and returns to the app',
    tags: ['Auth'],
    access: 'public',
    status: 302,
  })
  async googleCallback(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('state') _state?: string,
  ): Promise<void> {
    const [state, verifier] = (req.cookies[GOOGLE_COOKIE] ?? '').split('.');
    try {
      if (!state || !verifier) throw new Unauthorized();
      const result = await this.google.finish(new URL(req.url, this.env.API_URL), state, verifier);
      const session = await this.auth.signInFederated(result.userId, result.isNew, device(req));
      this.respond(req, reply, session, result.isNew);
      void reply.redirect(`${this.env.APP_URL}/enter/google/?new=${result.isNew ? '1' : '0'}`, 302);
    } catch {
      void reply.redirect(`${this.env.APP_URL}/enter/?error=google`, 302);
    }
  }
}
