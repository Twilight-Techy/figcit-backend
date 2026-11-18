import { Inject, Injectable } from '@nestjs/common';
import { SignJWT, importPKCS8, importSPKI, jwtVerify, type CryptoKey } from 'jose';
import { ENV, type Env } from '../config/env.js';

export interface AccessClaims {
  readonly sub: string; // user id
  readonly sid: string; // session id
  readonly roles: readonly string[];
  readonly mfa: boolean;
  /** Issued to a guest space: the guard then checks the session and the space's date on each request. */
  readonly guest?: boolean;
}

const ISSUER = 'figcit-api';
const AUDIENCE = 'figcit';

function pem(value: string): string {
  return value.includes('-----BEGIN')
    ? value.replace(/\\n/g, '\n')
    : Buffer.from(value, 'base64').toString('utf8');
}

/** Short-lived EdDSA access tokens (SYSTEM_DESIGN §9.1). */
@Injectable()
export class AccessTokens {
  private keys: Promise<{ priv: CryptoKey; pub: CryptoKey }> | undefined;

  constructor(@Inject(ENV) private readonly env: Env) {}

  private load(): Promise<{ priv: CryptoKey; pub: CryptoKey }> {
    this.keys ??= Promise.all([
      importPKCS8(pem(this.env.JWT_PRIVATE_KEY), 'EdDSA'),
      importSPKI(pem(this.env.JWT_PUBLIC_KEY), 'EdDSA'),
    ]).then(([priv, pub]) => ({ priv, pub }));
    return this.keys;
  }

  async sign(claims: AccessClaims, ttlSeconds = this.env.ACCESS_TTL_SECONDS): Promise<string> {
    const { priv } = await this.load();
    return new SignJWT({
      sid: claims.sid,
      roles: claims.roles,
      mfa: claims.mfa,
      ...(claims.guest ? { g: true } : {}),
    })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setSubject(claims.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${String(ttlSeconds)}s`)
      .sign(priv);
  }

  async verify(token: string): Promise<AccessClaims | null> {
    try {
      const { pub } = await this.load();
      const { payload } = await jwtVerify(token, pub, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['EdDSA'],
      });
      if (typeof payload.sub !== 'string' || typeof payload['sid'] !== 'string') return null;
      const roles = Array.isArray(payload['roles'])
        ? payload['roles'].filter((r): r is string => typeof r === 'string')
        : [];
      return {
        sub: payload.sub,
        sid: payload['sid'],
        roles,
        mfa: payload['mfa'] === true,
        ...(payload['g'] === true ? { guest: true } : {}),
      };
    } catch {
      return null;
    }
  }
}
