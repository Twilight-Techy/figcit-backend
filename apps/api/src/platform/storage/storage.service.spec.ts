import { describe, expect, it } from 'vitest';
import type { Env } from '../../common/config/env.js';
import { StorageService } from './storage.service.js';

const service = (endpoint: string): StorageService =>
  new StorageService({
    STORAGE_DRIVER: 's3',
    STORAGE_DIR: '/tmp/figcit-test-storage',
    S3_ENDPOINT: endpoint,
    S3_BUCKET: 'figcit-uploads',
    S3_REGION: 'eu-west-2',
    S3_ACCESS_KEY: 'AKIAEXAMPLE',
    S3_SECRET_KEY: 'secret',
    MASTER_KEYS: 'k',
    API_URL: 'https://app.example',
  } as unknown as Env);

describe('presigned links', () => {
  it("on AWS, use the bucket's own host, so the app's CSP can allow just that bucket", async () => {
    const { url } = await service('https://s3.eu-west-2.amazonaws.com').presignUpload(
      'dump/a.jpg',
      'image/jpeg',
    );
    const link = new URL(url);
    expect(link.origin).toBe('https://figcit-uploads.s3.eu-west-2.amazonaws.com');
    expect(link.pathname).toBe('/dump/a.jpg');
  });

  it('elsewhere (MinIO, R2), keep path-style links', async () => {
    const link = new URL(await service('http://localhost:9000').presignDownload('dump/a.jpg'));
    expect(link.origin).toBe('http://localhost:9000');
    expect(link.pathname).toBe('/figcit-uploads/dump/a.jpg');
  });
});
