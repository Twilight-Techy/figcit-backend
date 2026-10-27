import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { PrismaService } from '../db/prisma.service.js';
import { NotFound } from '../errors/errors.js';
import {
  decryptField,
  encryptField,
  newDataKey,
  parseMasterKeys,
  unwrapDataKey,
  wrapDataKey,
  type MasterKeyRing,
} from './envelope.js';

/** Encrypts and decrypts one user's fields. Obtain with `CryptoService.forUser`. */
export interface UserCipher {
  readonly userId: string;
  enc(text: string): Uint8Array<ArrayBuffer>;
  encOpt(text: string | null | undefined): Uint8Array<ArrayBuffer> | null;
  dec(blob: Uint8Array): string;
  decOpt(blob: Uint8Array | null | undefined): string | null;
}

const CACHE_LIMIT = 1000;
const CACHE_TTL_MS = 60_000;

@Injectable()
export class CryptoService {
  private readonly ring: MasterKeyRing;
  // Bounded LRU of unwrapped data keys (rules §6: every cache has a size and eviction).
  private readonly cache = new Map<string, { key: Buffer; at: number }>();

  constructor(
    @Inject(ENV) env: Env,
    private readonly prisma: PrismaService,
  ) {
    this.ring = parseMasterKeys(env.MASTER_KEYS);
  }

  /** A fresh wrapped data key for a new user. */
  newWrappedKey(): Uint8Array<ArrayBuffer> {
    return new Uint8Array(wrapDataKey(this.ring, newDataKey()));
  }

  cipherFor(userId: string, wrapped: Uint8Array): UserCipher {
    return this.makeCipher(userId, this.unwrap(userId, wrapped));
  }

  async forUser(userId: string): Promise<UserCipher> {
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return this.makeCipher(userId, cached.key);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dataKeyEnc: true },
    });
    if (!user) throw new NotFound('user');
    return this.makeCipher(userId, this.unwrap(userId, user.dataKeyEnc));
  }

  forget(userId: string): void {
    this.cache.delete(userId);
  }

  private unwrap(userId: string, wrapped: Uint8Array): Buffer {
    const key = unwrapDataKey(this.ring, wrapped);
    this.cache.delete(userId);
    this.cache.set(userId, { key, at: Date.now() });
    if (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return key;
  }

  private makeCipher(userId: string, key: Buffer): UserCipher {
    return {
      userId,
      enc: (text) => encryptField(key, userId, text),
      encOpt: (text) =>
        text === null || text === undefined || text === '' ? null : encryptField(key, userId, text),
      dec: (blob) => decryptField(key, userId, blob),
      decOpt: (blob) => (blob ? decryptField(key, userId, blob) : null),
    };
  }
}
