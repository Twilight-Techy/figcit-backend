import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Field-level envelope encryption (SYSTEM_DESIGN §9.3, DECISIONS B-04).
//
// Wrapped data key:  [format=1][masterKeyVersion: u16][iv: 12][tag: 16][ciphertext: 32]
// Encrypted field:   [format=1][iv: 12][tag: 16][ciphertext]
// Fields are bound to their owner's id as associated data, so ciphertext can't be moved between
// users.

const FORMAT = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export type MasterKeys = ReadonlyMap<number, Buffer>;

export interface MasterKeyRing {
  readonly current: number;
  readonly keys: MasterKeys;
}

/** Parses `MASTER_KEYS="1:<base64>,2:<base64>"`; the highest version encrypts new keys. */
export function parseMasterKeys(value: string): MasterKeyRing {
  const keys = new Map<number, Buffer>();
  for (const part of value.split(',').map((p) => p.trim()).filter(Boolean)) {
    const [versionText, encoded] = part.split(':');
    const version = Number(versionText);
    const key = Buffer.from(encoded ?? '', 'base64');
    if (!Number.isInteger(version) || version < 1 || version > 65_535 || key.length !== KEY_BYTES) {
      throw new Error('MASTER_KEYS entries must look like "<version>:<32 bytes base64>"');
    }
    keys.set(version, key);
  }
  if (keys.size === 0) throw new Error('MASTER_KEYS is empty');
  return { current: Math.max(...keys.keys()), keys };
}

function seal(key: Buffer, plaintext: Buffer, aad: Buffer): { iv: Buffer; tag: Buffer; ct: Buffer } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ct };
}

function open(key: Buffer, parts: { iv: Buffer; tag: Buffer; ct: Buffer }, aad: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, parts.iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(parts.tag);
  return Buffer.concat([decipher.update(parts.ct), decipher.final()]);
}

const WRAP_AAD = Buffer.from('figcit:data-key');

export function newDataKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

export function wrapDataKey(ring: MasterKeyRing, dataKey: Buffer): Buffer {
  const master = ring.keys.get(ring.current);
  if (!master) throw new Error('Current master key missing');
  const { iv, tag, ct } = seal(master, dataKey, WRAP_AAD);
  const header = Buffer.alloc(3);
  header.writeUInt8(FORMAT, 0);
  header.writeUInt16BE(ring.current, 1);
  return Buffer.concat([header, iv, tag, ct]);
}

export function masterKeyVersionOf(wrapped: Uint8Array): number {
  return Buffer.from(wrapped).readUInt16BE(1);
}

export function unwrapDataKey(ring: MasterKeyRing, wrapped: Uint8Array): Buffer {
  const buf = Buffer.from(wrapped);
  if (buf.readUInt8(0) !== FORMAT) throw new Error('Unknown wrapped key format');
  const master = ring.keys.get(buf.readUInt16BE(1));
  if (!master) throw new Error('Master key version not available');
  const iv = buf.subarray(3, 3 + IV_BYTES);
  const tag = buf.subarray(3 + IV_BYTES, 3 + IV_BYTES + TAG_BYTES);
  const ct = buf.subarray(3 + IV_BYTES + TAG_BYTES);
  return open(master, { iv, tag, ct }, WRAP_AAD);
}

export function encryptField(dataKey: Buffer, ownerId: string, plaintext: string): Uint8Array<ArrayBuffer> {
  const { iv, tag, ct } = seal(dataKey, Buffer.from(plaintext, 'utf8'), Buffer.from(ownerId));
  const out = new Uint8Array(1 + IV_BYTES + TAG_BYTES + ct.length);
  out[0] = FORMAT;
  out.set(iv, 1);
  out.set(tag, 1 + IV_BYTES);
  out.set(ct, 1 + IV_BYTES + TAG_BYTES);
  return out;
}

export function decryptField(dataKey: Buffer, ownerId: string, blob: Uint8Array): string {
  const buf = Buffer.from(blob);
  if (buf.readUInt8(0) !== FORMAT) throw new Error('Unknown field format');
  const iv = buf.subarray(1, 1 + IV_BYTES);
  const tag = buf.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
  const ct = buf.subarray(1 + IV_BYTES + TAG_BYTES);
  return open(dataKey, { iv, tag, ct }, Buffer.from(ownerId)).toString('utf8');
}

/** SHA-256 hex, for tokens and pseudonymous ids (never for passwords). */
export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

/** 256-bit random token, base64url. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
