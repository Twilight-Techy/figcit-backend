import { Inject, Injectable } from '@nestjs/common';
import * as oidc from 'openid-client';
import { ENV, type Env } from '../../common/config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotConfigured, Unauthorized } from '../../common/errors/errors.js';
import { UsersRepository } from '../users/users.repository.js';
import { graphemes } from '../../common/text/graphemes.js';

export interface GoogleStart {
  readonly url: string;
  readonly state: string;
  readonly verifier: string;
}

/** Google sign-in by the redirect flow with PKCE (openid-client); no Google script on our pages. */
@Injectable()
export class GoogleService {
  private config: Promise<oidc.Configuration> | undefined;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly users: UsersRepository,
    private readonly crypto: CryptoService,
  ) {}

  /** Whether Google sign-in can work here: the app hides the button when it can't (SU-2). */
  get configured(): boolean {
    return Boolean(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET);
  }

  private get redirectUri(): string {
    return `${this.env.API_URL}/v1/auth/google/callback`;
  }

  private discover(): Promise<oidc.Configuration> {
    if (!this.env.GOOGLE_CLIENT_ID || !this.env.GOOGLE_CLIENT_SECRET)
      throw new NotConfigured('Google sign-in');
    this.config ??= oidc.discovery(
      new URL('https://accounts.google.com'),
      this.env.GOOGLE_CLIENT_ID,
      this.env.GOOGLE_CLIENT_SECRET,
    );
    return this.config;
  }

  async start(): Promise<GoogleStart> {
    const config = await this.discover();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.redirectUri,
      scope: 'openid email profile',
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
      state,
      prompt: 'select_account',
    });
    return { url: url.href, state, verifier };
  }

  /** Exchanges the code, then finds or creates the user by Google subject (or verified email). */
  async finish(
    currentUrl: URL,
    state: string,
    verifier: string,
  ): Promise<{ userId: string; isNew: boolean }> {
    const config = await this.discover();
    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: verifier,
      expectedState: state,
    });
    const claims = tokens.claims();
    if (!claims?.sub) throw new Unauthorized('Google did not confirm your account.');
    const email =
      typeof claims['email'] === 'string' && claims['email_verified'] === true
        ? claims['email'].toLowerCase()
        : null;
    const identity = await this.prisma.authIdentity.findUnique({
      where: { provider_providerSubject: { provider: 'google', providerSubject: claims.sub } },
      select: { userId: true },
    });
    if (identity) return { userId: identity.userId, isNew: false };
    const existing = email ? await this.users.findByEmail(email) : null;
    const userId =
      existing?.id ??
      (
        await this.users.create({
          email,
          dataKeyEnc: this.crypto.newWrappedKey(),
          emailVerified: email !== null,
          // SU-6: Google's first name to start with; the user can change it on Your details.
          nickname: firstName(claims['given_name']),
        })
      ).id;
    await this.prisma.authIdentity.create({
      data: { userId, provider: 'google', providerSubject: claims.sub },
    });
    return { userId, isNew: !existing };
  }
}

/** Google's first name as a starting nickname (SU-6): trimmed to the 30 characters a name allows. */
export function firstName(given: unknown): string | null {
  if (typeof given !== 'string') return null;
  const name = graphemes(given.trim()).slice(0, 30).join('');
  return name.length ? name : null;
}
