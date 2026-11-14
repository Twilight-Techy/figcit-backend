import { createHmac } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { Client } from 'minio';
import { ENV, type Env } from '../../common/config/env.js';
import { safeEqual } from '../../common/crypto/envelope.js';

export interface PresignedUpload {
  readonly url: string;
  readonly method: 'PUT';
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

const UPLOAD_TTL_SECONDS = 15 * 60;
const DOWNLOAD_TTL_SECONDS = 24 * 60 * 60;

/**
 * Private object storage through the S3 API (minio client; SeaweedFS or any S3 provider). File bytes
 * never pass through the API in production. The `local` driver (development, tests) stores files on
 * disk and serves them through HMAC-signed URLs on `/v1/files/local/…`.
 */
@Injectable()
export class StorageService {
  private readonly s3: Client | undefined;
  private readonly root: string;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.root = resolve(env.STORAGE_DIR);
    if (env.STORAGE_DRIVER === 's3' && env.S3_ENDPOINT) {
      const url = new URL(env.S3_ENDPOINT);
      this.s3 = new Client({
        endPoint: url.hostname,
        port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
        useSSL: url.protocol === 'https:',
        accessKey: env.S3_ACCESS_KEY ?? '',
        secretKey: env.S3_SECRET_KEY ?? '',
        region: env.S3_REGION,
        // AWS: links on the bucket's own host, so the app's CSP can allow just this bucket.
        // Other stores (MinIO locally, R2) keep path-style links.
        pathStyle: !url.hostname.endsWith('.amazonaws.com'),
      });
    }
  }

  private sign(key: string, method: string, expires: number): string {
    return createHmac('sha256', this.env.MASTER_KEYS)
      .update(`${method}\n${key}\n${String(expires)}`)
      .digest('base64url');
  }

  private localUrl(
    key: string,
    method: 'PUT' | 'GET',
    ttl: number,
  ): { url: string; expires: number } {
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const sig = this.sign(key, method, expires);
    return {
      url: `${this.env.API_URL}/v1/files/local/${encodeURIComponent(key)}?e=${String(expires)}&s=${sig}`,
      expires,
    };
  }

  verifyLocal(key: string, method: 'PUT' | 'GET', expires: number, sig: string): boolean {
    return (
      expires >= Math.floor(Date.now() / 1000) && safeEqual(sig, this.sign(key, method, expires))
    );
  }

  async presignUpload(key: string, contentType: string): Promise<PresignedUpload> {
    const headers = { 'content-type': contentType };
    if (this.s3) {
      const url = await this.s3.presignedPutObject(this.env.S3_BUCKET, key, UPLOAD_TTL_SECONDS);
      return {
        url,
        method: 'PUT',
        headers,
        expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
      };
    }
    const { url, expires } = this.localUrl(key, 'PUT', UPLOAD_TTL_SECONDS);
    return { url, method: 'PUT', headers, expiresAt: new Date(expires * 1000).toISOString() };
  }

  async presignDownload(key: string): Promise<string> {
    if (this.s3) return this.s3.presignedGetObject(this.env.S3_BUCKET, key, DOWNLOAD_TTL_SECONDS);
    return this.localUrl(key, 'GET', DOWNLOAD_TTL_SECONDS).url;
  }

  private path(key: string): string {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root)) throw new Error('bad storage key');
    return full;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.s3) {
      await this.s3.putObject(this.env.S3_BUCKET, key, body, body.length, {
        'Content-Type': contentType,
      });
      return;
    }
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async get(key: string): Promise<Buffer> {
    if (this.s3) {
      const stream = await this.s3.getObject(this.env.S3_BUCKET, key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks);
    }
    return readFile(this.path(key));
  }

  async remove(key: string): Promise<void> {
    if (this.s3) {
      await this.s3.removeObject(this.env.S3_BUCKET, key);
      return;
    }
    await rm(this.path(key), { force: true });
  }
}
